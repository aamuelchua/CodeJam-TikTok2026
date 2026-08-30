"""
State Machine: LangChain + OpenAI-compatible remote API slot extraction and intent-override logic.

Reads configuration from backend/.env:
  API_KEY  — remote API key
  MODEL    — model name (default: llama3.1:8b)
  BASE_URL — OpenAI-compatible endpoint base URL

Slots maintained per session:
  - intentTrack:     "BUYING" | "BROWSING"
  - hardFilters:     dict  (category, max_price, min_price, brand, …)
  - negativeFilters: list[str]  (terms to exclude)
  - softPreferences: list[str]  (nice-to-have descriptors)

Intent Override:
  If the model detects a negation/correction (e.g., "actually not red"),
  conflicting past slots are erased and the term moved to negativeFilters.
"""
from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain.prompts import ChatPromptTemplate
from langchain.schema import HumanMessage, SystemMessage

# Load .env from the repository root (fallback to backend/.env)
_ROOT_ENV = Path(__file__).resolve().parents[3] / ".env"
_BACKEND_ENV = Path(__file__).resolve().parents[2] / ".env"
if _ROOT_ENV.exists():
    load_dotenv(dotenv_path=_ROOT_ENV, override=False)
elif _BACKEND_ENV.exists():
    load_dotenv(dotenv_path=_BACKEND_ENV, override=False)
else:
    load_dotenv(override=False)

_API_KEY: str = os.environ.get("ARK_API_KEY") or os.environ.get("API_KEY", "")
_MODEL: str = (os.environ.get("ARK_MODEL") or os.environ.get("MODEL", "llama3.1:8b")).strip('"').strip("'")
_BASE_URL: str = (os.environ.get("ARK_BASE_URL") or os.environ.get("BASE_URL", "https://api.openai.com/v1")).rstrip("/")

_SYSTEM_INSTRUCTION = """\
You are a shopping assistant slot extractor. Given the conversation history and the latest user message, \
extract or update the shopping slots. Respond ONLY with valid JSON matching this exact schema:

{
  "intentTrack": "BUYING" or "BROWSING",
  "hardFilters": {"category": str|null, "max_price": number|null, "min_price": number|null, "brand": str|null},
  "negativeFilters": [list of strings the user does NOT want],
  "softPreferences": [list of preferred descriptors],
  "intentOverride": [list of slot keys that the user explicitly overrode/negated this turn]
}

Rules:
- If user corrects a previous preference (e.g. "actually not leather"), add it to negativeFilters and add the key to intentOverride.
- intentTrack = "BUYING" if the user has specific requirements (price, brand, category). Otherwise "BROWSING".
- Preserve previously extracted slots unless overridden.
- intentOverride should list which previous filters to erase.
- Respond with ONLY the JSON object — no markdown fences, no commentary.\
"""


@dataclass
class ConversationState:
    intent_track: str = "BROWSING"
    hard_filters: dict[str, Any] = field(default_factory=dict)
    negative_filters: list[str] = field(default_factory=list)
    soft_preferences: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "intentTrack": self.intent_track,
            "hardFilters": self.hard_filters,
            "negativeFilters": self.negative_filters,
            "softPreferences": self.soft_preferences,
        }

    @classmethod
    def from_snapshot(cls, snapshot: dict) -> "ConversationState":
        return cls(
            intent_track=snapshot.get("intentTrack", "BROWSING"),
            hard_filters=json.loads(snapshot.get("hardFilters", "{}")),
            negative_filters=json.loads(snapshot.get("negativeFilters", "[]")),
            soft_preferences=json.loads(snapshot.get("softPreferences", "[]")),
        )


def _get_llm() -> ChatOpenAI:
    """Return a ChatOpenAI client pointed at the remote OpenAI-compatible endpoint."""
    return ChatOpenAI(
        model=_MODEL,
        api_key=_API_KEY,
        base_url=_BASE_URL,
        temperature=0,
        max_retries=2,
    )


def _extract_json(text: str) -> dict:
    """Extract the first JSON object from an LLM response string."""
    text = text.strip()
    # Strip markdown code fences if present
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    # Try direct parse
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    # Fallback: find first {...} block
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass
    return {}


def _apply_intent_override(state: ConversationState, overrides: list[str]) -> None:
    """Erase any hard_filters keys named in overrides."""
    for key in overrides:
        if key in state.hard_filters:
            del state.hard_filters[key]
        # Also remove from soft_preferences if present
        state.soft_preferences = [
            pref for pref in state.soft_preferences if key.lower() not in pref.lower()
        ]


async def update_state(
    current_state: ConversationState,
    user_message: str,
    history: list[dict[str, str]],
) -> ConversationState:
    """
    Call the remote LLM to extract new slots from the user message, apply intent
    overrides, and return the merged updated state.

    history: list of {"sender": "USER"|"AGENT", "content": str}
    """
    llm = _get_llm()

    history_text = "\n".join(
        f"{h['sender']}: {h['content']}" for h in history[-5:]
    )
    previous_slots_text = json.dumps(current_state.to_dict(), indent=2)

    user_prompt = (
        f"Previous slots:\n{previous_slots_text}\n\n"
        f"Conversation history (last 5 turns):\n{history_text}\n\n"
        f"Latest user message:\n{user_message}\n\n"
        "JSON response:"
    )

    messages = [
        SystemMessage(content=_SYSTEM_INSTRUCTION),
        HumanMessage(content=user_prompt),
    ]

    try:
        response = await llm.ainvoke(messages)
        raw_text = response.content if hasattr(response, "content") else str(response)
        extracted = _extract_json(raw_text)
    except Exception as exc:
        # Gracefully degrade: keep current state if LLM fails
        print(f"[state_machine] LLM call failed: {exc}")
        return current_state

    if not extracted:
        return current_state

    # Build new state, applying overrides first
    new_state = ConversationState(
        intent_track=extracted.get("intentTrack", current_state.intent_track),
        hard_filters=dict(current_state.hard_filters),
        negative_filters=list(current_state.negative_filters),
        soft_preferences=list(current_state.soft_preferences),
    )

    # Apply intent overrides (erase conflicting slots)
    intent_overrides = extracted.get("intentOverride", [])
    _apply_intent_override(new_state, intent_overrides)

    # Merge new hard filters (non-null values overwrite)
    for k, v in (extracted.get("hardFilters") or {}).items():
        if v is not None:
            new_state.hard_filters[k] = v

    # Merge negative filters (union, deduplicated)
    new_negs = extracted.get("negativeFilters") or []
    for neg in new_negs:
        if neg and neg not in new_state.negative_filters:
            new_state.negative_filters.append(neg)

    # Merge soft preferences (union, deduplicated)
    new_prefs = extracted.get("softPreferences") or []
    for pref in new_prefs:
        if pref and pref not in new_state.soft_preferences:
            new_state.soft_preferences.append(pref)

    return new_state


def build_query(state: ConversationState) -> str:
    """Construct a retrieval query string from current slots."""
    parts: list[str] = []
    hf = state.hard_filters
    if hf.get("category"):
        parts.append(hf["category"])
    if hf.get("brand"):
        parts.append(hf["brand"])
    parts.extend(state.soft_preferences)
    return " ".join(parts) if parts else "product"
