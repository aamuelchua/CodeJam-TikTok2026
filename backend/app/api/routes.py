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



class UserAuthRequest(BaseModel):
    email: str
    name: str | None = None
    selected_interests: list[str] | None = None


class UserUpdateRequest(BaseModel):
    name: str | None = None
    selected_interests: list[str] | None = None
    derived_interests: list[str] | None = None
    cart: list[dict[str, Any]] | None = None


class CheckoutRequest(BaseModel):
    items: list[dict[str, Any]]
    total_amount: float


# Helper serializer for User
def _serialize_user(user, orders=None) -> dict[str, Any]:
    sel_int = json.loads(user.selectedInterests) if user.selectedInterests else []
    der_int = json.loads(user.derivedInterests) if user.derivedInterests else []
    cart_items = json.loads(user.cart) if user.cart else []
    orders_list = []
    if orders:
        for o in orders:
            orders_list.append({
                "id": o.id,
                "totalAmount": o.totalAmount,
                "items": json.loads(o.items) if o.items else [],
                "createdAt": o.createdAt.isoformat(),
            })
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "selectedInterests": sel_int,
        "derivedInterests": der_int,
        "cart": cart_items,
        "orders": orders_list,
        "createdAt": user.createdAt.isoformat() if hasattr(user.createdAt, "isoformat") else str(user.createdAt),
    }


# ---------------------------------------------------------------------------
# User Authentication & Admin Endpoints
# ---------------------------------------------------------------------------

@router.post("/users/auth", status_code=200)
async def auth_user(body: UserAuthRequest):
    """
    Passwordless login / registration by email.
    If existing email, returns user details.
    If new email, creates user with provided selected_interests.
    """
    db = get_client()
    email_clean = body.email.strip().lower()

    user = await db.user.find_unique(where={"email": email_clean}, include={"orders": True})
    if user:
        return _serialize_user(user, orders=user.orders)

    # Register new user
    name_val = body.name.strip() if body.name else email_clean.split("@")[0].capitalize()
    sel_int = json.dumps(body.selected_interests or [])

    new_user = await db.user.create(
        data={
            "email": email_clean,
            "name": name_val,
            "selectedInterests": sel_int,
            "derivedInterests": json.dumps([]),
            "cart": json.dumps([]),
        }
    )
    return _serialize_user(new_user)


@router.get("/users")
async def list_all_users():
    """Admin Endpoint: List all registered users with their orders, cart, and interests."""
    db = get_client()
    users = await db.user.find_many(include={"orders": True}, order={"createdAt": "desc"})
    return {"users": [_serialize_user(u, orders=u.orders) for u in users]}


@router.get("/users/{email}")
async def get_user_profile(email: str):
    """Get complete profile inspection payload for a single user."""
    db = get_client()
    email_clean = email.strip().lower()
    user = await db.user.find_unique(where={"email": email_clean}, include={"orders": True})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return _serialize_user(user, orders=user.orders)


@router.put("/users/{email}")
async def update_user_profile(email: str, body: UserUpdateRequest):
    """Admin/User Endpoint: Update user profile name, selected interests, derived interests, or cart."""
    db = get_client()
    email_clean = email.strip().lower()

    user = await db.user.find_unique(where={"email": email_clean})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    update_data: dict[str, Any] = {}
    if body.name is not None:
        update_data["name"] = body.name
    if body.selected_interests is not None:
        update_data["selectedInterests"] = json.dumps(body.selected_interests)
    if body.derived_interests is not None:
        update_data["derivedInterests"] = json.dumps(body.derived_interests)
    if body.cart is not None:
        update_data["cart"] = json.dumps(body.cart)

    updated_user = await db.user.update(
        where={"email": email_clean},
        data=update_data,
        include={"orders": True},
    )
    return _serialize_user(updated_user, orders=updated_user.orders)


@router.delete("/users/{email}")
async def delete_user_account(email: str):
    """Admin Endpoint: Delete user profile and account permanently."""
    db = get_client()
    email_clean = email.strip().lower()
    user = await db.user.find_unique(where={"email": email_clean})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    await db.user.delete(where={"email": email_clean})
    return {"status": "deleted", "email": email_clean}


@router.post("/users/{email}/checkout")
async def user_checkout(email: str, body: CheckoutRequest):
    """Process simulated payment checkout for a user, record Order, and clear cart."""
    db = get_client()
    email_clean = email.strip().lower()
    user = await db.user.find_unique(where={"email": email_clean})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    order = await db.order.create(
        data={
            "userId": user.id,
            "totalAmount": body.total_amount,
            "items": json.dumps(body.items),
        }
    )

    # Clear user cart
    await db.user.update(
        where={"email": email_clean},
        data={"cart": json.dumps([])},
    )

    return {
        "orderId": order.id,
        "totalAmount": order.totalAmount,
        "items": body.items,
        "createdAt": order.createdAt.isoformat(),
    }


@router.get("/interest-chips")
async def get_dynamic_interest_chips():
    """
    Return static category hierarchy and dynamically generated sub-interest chips derived from catalog.jsonl.
    """
    category_map = {
        "Women's Fashion": [
            "Women's Shoes", "House Slippers", "Fuzzy Slippers", "Memory Foam Insoles",
            "Statement Earrings", "Handbags & Totes", "Dresses & Outerwear", "Sneakers",
        ],
        "Men's Apparel & Shoes": [
            "Athletic Running Shoes", "Cushioned EVA Midsole", "Non-Slip Sneakers",
            "Work Boots", "Watches & Accessories", "Casual Wear",
        ],
        "Electronics & Audio": [
            "True Wireless Earbuds", "Active Noise Cancellation", "Bluetooth 5.3",
            "Fitness Smartwatches", "Heart Rate Monitors", "Touchscreen HD",
        ],
        "Home & Furniture": [
            "Ergonomic Mesh Chairs", "Desk Chairs", "Adjustable Lumbar Support",
            "Thermal Espresso Machines", "Coffee Makers", "Home Barista Station",
        ],
        "Sports & Outdoor": [
            "Thick Yoga Mats", "Non-Slip TPE Foam", "Alignment Lines",
            "Fitness & Pilates Gear", "Travel Backpacks", "Travel Accessories",
        ]
    }
    return {"categories": category_map}


@router.get("/sessions/{session_id}/state")
async def get_session_state(session_id: str):
    """Return current slot state for a session."""
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

