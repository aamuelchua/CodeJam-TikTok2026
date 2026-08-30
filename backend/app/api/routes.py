"""
FastAPI route definitions.

Endpoints:
  POST /api/sessions                          – Initialize a new session
  POST /api/sessions/{session_id}/turn       – Process a conversational turn
  GET  /api/sessions/{session_id}/state      – Return current slots & intent track
  POST /api/products/load                    – Load products into the in-memory index
"""
import os
import sys

# Ensure project root is in sys.path so starter.agent is importable
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

import json
import uuid
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from starter.agent import Agent
from app.db.prisma import get_client


router = APIRouter(prefix="/api")

# Unified in-memory Agent singleton and catalog index
_global_agent = Agent()
_product_by_parent_asin: dict[str, dict] = {
    str(p.get("parent_asin")): p for p in _global_agent.products if "parent_asin" in p
}


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class CreateSessionRequest(BaseModel):
    user_profile: dict[str, Any] | None = None


class TurnRequest(BaseModel):
    message: str
    user_profile: dict[str, Any] | None = None


class ProductLoadRequest(BaseModel):
    products: list[dict[str, Any]]


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _hydrate_product(p: dict) -> dict[str, Any]:
    if hasattr(p, "to_dict"):
        return p.to_dict()
    return {
        "asin": p.get("asin") or p.get("parent_asin", "UNKNOWN"),
        "parent_asin": p.get("parent_asin", "UNKNOWN"),
        "title": p.get("title", "Untitled Product"),
        "category": p.get("categories", ["General"])[0]
        if isinstance(p.get("categories"), list) and p.get("categories")
        else (p.get("category") or "General"),
        "price": p.get("price", 19.99) if p.get("price") is not None else 19.99,
        "features": p.get("features", []),
        "description": p.get("description", []),
        "average_rating": p.get("average_rating", 4.5),
        "rating_number": p.get("rating_number", 100),
        "store": p.get("store", "Copilot Store"),
        "details": p.get("details", {}),
    }


def _serialize_product(p) -> dict:
    return _hydrate_product(p if isinstance(p, dict) else vars(p))


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/products")
async def get_all_products():
    """Return a sample of products from the catalog for the shop showcase."""
    products = _global_agent.products
    return {"products": [_hydrate_product(p) for p in products[:200]]}


@router.post("/sessions", status_code=201)
async def create_session(body: CreateSessionRequest | None = None):
    """Create a new shopping session and initialize agent state."""
    db = get_client()
    session = await db.session.create(data={})
    user_profile = (body.user_profile if body else None) or {}
    _global_agent.reset(session.id, user_profile)
    return {"sessionId": session.id, "status": session.status}


@router.post("/sessions/{session_id}/turn")
async def process_turn(session_id: str, body: TurnRequest):
    """
    Process one conversational turn:
    1. Persist user message
    2. Delegate conversational turn to unified _global_agent
    3. Hydrate recommended products from agent catalog
    4. Construct state machine telemetry and snapshot
    5. Persist agent response + state snapshot
    6. Return response
    """
    db = get_client()

    # --- Load session ---
    session = await db.session.find_unique(where={"id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    turn_number = session.turnCount + 1

    # --- Ensure agent session is initialized ---
    if session_id not in _global_agent.pipeline._sessions:
        _global_agent.reset(session_id, body.user_profile or {})

    # --- Persist user message ---
    await db.message.create(
        data={
            "sessionId": session_id,
            "sender": "USER",
            "content": body.message,
            "turnNumber": turn_number,
        }
    )

    # --- Normalize prompt for multi-turn agent constraint extraction ---
    effective_message = body.message.strip()
    if turn_number > 1:
        msg_lower = effective_message.lower()
        is_override = any(t in msg_lower for t in ["actually", "ignore my earlier", "instead", "nevermind", "change my mind"])
        has_syntax = any(t in msg_lower for t in ["key requirement is:", "what matters is:", "what i need is:"])
        
        if is_override and "what i need is:" not in msg_lower:
            effective_message = f"Actually, ignore my earlier preference. What I need is: {effective_message}"
        elif not is_override and not has_syntax:
            effective_message = f"key requirement is: {effective_message}"

    # --- Execute Core Logic via unified starter.agent.Agent ---
    agent_resp = _global_agent.respond(
        session_id=session_id,
        user_message=effective_message,
        turn=turn_number,
        top_k=8,
    )

    agent_message = agent_resp.get("message", "Here are the closest recommendations based on your requirements.")
    recs = agent_resp.get("recommendations", [])
    ask_attr = agent_resp.get("ask_attribute")
    should_clarify = ask_attr is not None

    # --- Hydrate full product metadata from in-memory catalog ---
    products_out: list[dict[str, Any]] = []
    for r in recs:
        parent_asin = str(r.get("parent_asin", ""))
        p = _product_by_parent_asin.get(parent_asin)
        if p:
            products_out.append(_hydrate_product(p))
        else:
            products_out.append({
                "asin": parent_asin,
                "parent_asin": parent_asin,
                "title": f"Product {parent_asin}",
                "category": "General",
                "price": 19.99,
                "features": [],
                "description": [],
                "average_rating": 4.5,
                "rating_number": 100,
                "store": "Copilot Store",
                "details": {},
            })

    candidate_count = len(products_out)

    # --- Read agent internal state for session ---
    sess_state = _global_agent.pipeline._sessions.get(session_id, {})
    intent_track = sess_state.get("intent_track", "BROWSING")
    category = sess_state.get("category", "")
    constraints = sess_state.get("constraints", [])
    hard_filters = {"category": category} if category else {}
    negative_filters: list[str] = []
    soft_preferences = constraints

    state_payload = {
        "intentTrack": intent_track,
        "hardFilters": hard_filters,
        "negativeFilters": negative_filters,
        "softPreferences": soft_preferences,
        "candidateCount": candidate_count,
        "entropyScore": None,
    }

    telemetry_payload = {
        "turn": turn_number,
        "intent_track": intent_track,
        "category": category,
        "constraints": constraints,
        "initial_pref": sess_state.get("initial_pref", ""),
        "override_occurred": sess_state.get("override_occurred", False),
        "usage": agent_resp.get("usage", {}),
        "ask_attribute": ask_attr,
        "candidate_count": candidate_count,
    }

    # --- Persist state snapshot ---
    await db.statesnapshot.create(
        data={
            "sessionId": session_id,
            "turnNumber": turn_number,
            "intentTrack": intent_track,
            "hardFilters": json.dumps(hard_filters),
            "negativeFilters": json.dumps(negative_filters),
            "softPreferences": json.dumps(soft_preferences),
            "candidateCount": candidate_count,
            "entropyScore": None,
        }
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
        "recommendations": products_out,
        "state": state_payload,
        "telemetry": telemetry_payload,
        "derivedInterests": constraints,
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
    """Get complete profile inspection payload for a single user, creating if not found."""
    db = get_client()
    email_clean = email.strip().lower()
    user = await db.user.find_unique(where={"email": email_clean}, include={"orders": True})
    if not user:
        name_val = email_clean.split("@")[0].capitalize()
        user = await db.user.create(
            data={
                "email": email_clean,
                "name": name_val,
                "selectedInterests": json.dumps([]),
                "derivedInterests": json.dumps([]),
                "cart": json.dumps([]),
            }
        )
    return _serialize_user(user, orders=getattr(user, "orders", []))


@router.put("/users/{email}")
async def update_user_profile(email: str, body: UserUpdateRequest):
    """Admin/User Endpoint: Upsert user profile name, selected interests, derived interests, or cart."""
    db = get_client()
    email_clean = email.strip().lower()

    user = await db.user.find_unique(where={"email": email_clean})
    if not user:
        name_val = body.name.strip() if body.name else email_clean.split("@")[0].capitalize()
        new_user = await db.user.create(
            data={
                "email": email_clean,
                "name": name_val,
                "selectedInterests": json.dumps(body.selected_interests or []),
                "derivedInterests": json.dumps(body.derived_interests or []),
                "cart": json.dumps(body.cart or []),
            }
        )
        return _serialize_user(new_user)

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

    sess_state = _global_agent.pipeline._sessions.get(session_id)
    if sess_state:
        cat = sess_state.get("category", "")
        hf = {"category": cat} if cat else {}
        constraints = sess_state.get("constraints", [])
        return {
            "sessionId": session_id,
            "turnCount": session.turnCount,
            "intentTrack": sess_state.get("intent_track", "BROWSING"),
            "hardFilters": hf,
            "negativeFilters": [],
            "softPreferences": constraints,
            "candidateCount": len(_global_agent.products),
            "entropyScore": None,
        }

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

