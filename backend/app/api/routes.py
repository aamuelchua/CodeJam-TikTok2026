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

class TurnRequest(BaseModel):
    message: str


class ProductLoadRequest(BaseModel):
    products: list[dict[str, Any]]


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _serialize_product(p) -> dict:
    return {
        "asin": p.asin,
        "title": p.title,
        "category": p.category,
        "price": p.price,
        "features": p.features,
        "description": p.description,
    }


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

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
    3. Retrieve candidates
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

    # --- Classify intent (rule-based fast path) ---
    intent_track = classify_intent(body.message, current_state.intent_track)
    current_state.intent_track = intent_track

    # --- Update slots via LLM state machine ---
    updated_state = await update_state(current_state, body.message, history)

    # --- Build retrieval query ---
    query = build_query(updated_state)

    # --- Retrieve candidates ---
    candidates = retrieve(
        query=query,
        intent_track=updated_state.intent_track,
        hard_filters=updated_state.hard_filters,
        negative_filters=updated_state.negative_filters,
        top_k=150,
    )

    # --- Entropy check ---
    entropy_result = compute_entropy(candidates, turn_number)

    # --- Prepare response ---
    if entropy_result.should_clarify:
        agent_message = entropy_result.clarification_question or "Could you give me more details?"
        products_out: list[dict] = []
    else:
        # Rerank top 30, return top 10
        top30 = candidates[:30]
        top10 = rerank(query, top30, top_k=10)
        products_out = [_serialize_product(p) for p in top10]
        agent_message = (
            f"Here are my top {len(products_out)} recommendations for you!"
            if products_out
            else "I couldn't find any products matching your criteria. Could you broaden your search?"
        )

    # --- Persist agent message ---
    await db.message.create(
        data={
            "sessionId": session_id,
            "sender": "AGENT",
            "content": agent_message,
            "turnNumber": turn_number,
        }
    )

    # --- Persist state snapshot ---
    await db.statesnapshot.create(
        data={
            "sessionId": session_id,
            "turnNumber": turn_number,
            "intentTrack": updated_state.intent_track,
            "hardFilters": json.dumps(updated_state.hard_filters),
            "negativeFilters": json.dumps(updated_state.negative_filters),
            "softPreferences": json.dumps(updated_state.soft_preferences),
            "candidateCount": len(candidates),
            "entropyScore": entropy_result.entropy_score,
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
        "shouldClarify": entropy_result.should_clarify,
        "clarificationAttr": entropy_result.clarification_attr,
        "entropyScore": entropy_result.entropy_score,
        "candidateCount": len(candidates),
        "products": products_out,
        "state": updated_state.to_dict(),
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
