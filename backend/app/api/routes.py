"""
FastAPI route definitions.

Endpoints:
  POST /api/sessions                          – Initialize a new session
  POST /api/sessions/{session_id}/turn       – Process a conversational turn
  GET  /api/sessions/{session_id}/state      – Return current slots & intent track
  POST /api/products/load                    – Load products into the in-memory index
"""
from __future__ import annotations

import json
import uuid
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.entropy import compute_entropy
from app.core.reranker import rerank
from app.core.retriever import retrieve, load_products
from app.core.router import classify_intent
from app.core.state_machine import ConversationState, update_state, build_query
from app.db.prisma import get_client

router = APIRouter(prefix="/api")


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class TurnRequest(BaseModel):
    message: str
    user_profile: dict[str, Any] | None = None


class ProductLoadRequest(BaseModel):
    products: list[dict[str, Any]]


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _serialize_product(p) -> dict:
    if hasattr(p, "to_dict"):
        return p.to_dict()
    return {
        "asin": getattr(p, "asin", "UNKNOWN"),
        "parent_asin": getattr(p, "parent_asin", getattr(p, "asin", "UNKNOWN")),
        "title": getattr(p, "title", "Untitled Product"),
        "category": getattr(p, "category", ""),
        "price": getattr(p, "price", None),
        "features": getattr(p, "features", []),
        "description": getattr(p, "description", []),
        "average_rating": getattr(p, "average_rating", 4.5),
        "rating_number": getattr(p, "rating_number", 100),
        "store": getattr(p, "store", "Store"),
        "details": getattr(p, "details", {}),
    }


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/products")
async def get_all_products():
    """Return all products currently indexed in the catalog."""
    from app.core.retriever import get_index
    idx = get_index()
    if not idx.is_ready() or not idx.products:
        return {"products": []}
    return {"products": [_serialize_product(p) for p in idx.products]}


@router.post("/sessions", status_code=201)
async def create_session():
    """Create a new shopping session."""
    db = get_client()
    session = await db.session.create(data={})
    return {"sessionId": session.id, "status": session.status}


@router.post("/sessions/{session_id}/turn")
async def process_turn(session_id: str, body: TurnRequest):
    """
    Process one conversational turn:
    1. Persist user message
    2. Update state machine slots via LLM
    3. Retrieve candidates using dense RAG vectors + user profile embeddings
    4. Compute entropy → clarify or rerank
    5. Persist agent response + state snapshot
    6. Return response
    """
    db = get_client()

    # --- Load session ---
    session = await db.session.find_unique(where={"id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    turn_number = session.turnCount + 1

    # --- Extract user profile interests ---
    user_interests: list[str] = []
    if body.user_profile and isinstance(body.user_profile.get("interests"), list):
        user_interests = [str(x) for x in body.user_profile["interests"] if str(x).strip()]

    # --- Persist user message ---
    await db.message.create(
        data={
            "sessionId": session_id,
            "sender": "USER",
            "content": body.message,
            "turnNumber": turn_number,
        }
    )

    # --- Fetch recent history for context ---
    recent_msgs = await db.message.find_many(
        where={"sessionId": session_id},
        order={"createdAt": "asc"},
        take=10,
    )
    history = [{"sender": m.sender, "content": m.content} for m in recent_msgs]

    # --- Load latest state snapshot ---
    snapshots = await db.statesnapshot.find_many(
        where={"sessionId": session_id},
        order={"turnNumber": "desc"},
        take=1,
    )
    if snapshots:
        snap = snapshots[0]
        current_state = ConversationState.from_snapshot(
            {
                "intentTrack": snap.intentTrack,
                "hardFilters": snap.hardFilters,
                "negativeFilters": snap.negativeFilters,
                "softPreferences": snap.softPreferences,
            }
        )
    else:
        current_state = ConversationState()

    # Merge user interests into soft preferences if not already present
    for interest in user_interests:
        if interest not in current_state.soft_preferences:
            current_state.soft_preferences.append(interest)

    # --- Classify intent (rule-based fast path) ---
    intent_track = classify_intent(body.message, current_state.intent_track)
    current_state.intent_track = intent_track

    # --- Execute LangChain RAG Pipeline ---
    from app.core.rag_pipeline import process_rag_turn
    rag_result = process_rag_turn(
        user_query=body.message,
        user_profile=body.user_profile,
        history=history,
        top_k=8,
    )

    agent_message = rag_result["agentMessage"]
    products_out = rag_result["products"]
    should_clarify = rag_result.get("shouldClarify", False)
    candidate_count = rag_result.get("candidateCount", len(products_out))

    # --- Persist agent message ---
    await db.message.create(
        data={
            "sessionId": session_id,
            "sender": "AGENT",
            "content": agent_message,
            "turnNumber": turn_number,
        }
    )

    # --- Update session turn count ---
    await db.session.update(
        where={"id": session_id},
        data={"turnCount": turn_number},
    )

    return {
        "sessionId": session_id,
        "turnNumber": turn_number,
        "agentMessage": agent_message,
        "shouldClarify": should_clarify,
        "candidateCount": candidate_count,
        "products": products_out,
    }



@router.get("/sessions/{session_id}/state")
async def get_session_state(session_id: str):
    """Return the current slot state and intent track for a session."""
    db = get_client()

    session = await db.session.find_unique(where={"id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    snapshots = await db.statesnapshot.find_many(
        where={"sessionId": session_id},
        order={"turnNumber": "desc"},
        take=1,
    )

    if not snapshots:
        return {
            "sessionId": session_id,
            "turnCount": session.turnCount,
            "intentTrack": "BROWSING",
            "hardFilters": {},
            "negativeFilters": [],
            "softPreferences": [],
            "candidateCount": 0,
            "entropyScore": None,
        }

    snap = snapshots[0]
    return {
        "sessionId": session_id,
        "turnCount": session.turnCount,
        "intentTrack": snap.intentTrack,
        "hardFilters": json.loads(snap.hardFilters),
        "negativeFilters": json.loads(snap.negativeFilters),
        "softPreferences": json.loads(snap.softPreferences),
        "candidateCount": snap.candidateCount,
        "entropyScore": snap.entropyScore,
    }


@router.post("/products/load", status_code=200)
async def load_product_index(body: ProductLoadRequest):
    """
    Load a list of product dicts into the in-memory search index.
    Also upserts them into SQLite via Prisma.
    """
    db = get_client()

    # Upsert into SQLite
    for p in body.products:
        await db.product.upsert(
            where={"asin": p["asin"]},
            data={
                "create": {
                    "asin": p["asin"],
                    "title": p.get("title", ""),
                    "category": p.get("category", ""),
                    "price": p.get("price"),
                    "features": p.get("features"),
                    "description": p.get("description"),
                },
                "update": {
                    "title": p.get("title", ""),
                    "category": p.get("category", ""),
                    "price": p.get("price"),
                    "features": p.get("features"),
                    "description": p.get("description"),
                },
            },
        )

    # Build in-memory index
    load_products(body.products)

    return {"loaded": len(body.products)}
