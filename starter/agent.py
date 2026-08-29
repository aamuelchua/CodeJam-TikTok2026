from __future__ import annotations

import os
import sys
from typing import Any

# Ensure project root & backend are in python path
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND_DIR = os.path.join(ROOT_DIR, "backend")
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app.core.rag_pipeline import process_rag_turn, get_vectorstore, get_llm


class Agent:
    """
    Official TechJam 2026 Agent Implementation.
    Combines FAISS Vector RAG Search, State Machine Intent Tracking,
    and Llama 3.1 8B LLM response generation.
    """

    def __init__(self):
        self.sessions: dict[str, dict[str, Any]] = {}
        # Warmup vector index & LLM singleton
        try:
            get_vectorstore()
        except Exception as e:
            print(f"[Agent Init Warning] Vectorstore warmup: {e}")

    def reset(self, session_id: str, user_profile: dict[str, Any] | None = None) -> None:
        """Initialize or reset state for a given session."""
        self.sessions[session_id] = {
            "session_id": session_id,
            "user_profile": user_profile or {},
            "history": [],
            "turn_count": 0,
        }

    def respond(
        self,
        session_id: str,
        user_message: str,
        turn: int = 1,
        top_k: int = 10,
    ) -> dict[str, Any]:
        """
        Process conversational turn and return response object conforming to Agent API Contract.
        """
        if session_id not in self.sessions:
            self.reset(session_id)

        session_data = self.sessions[session_id]
        user_profile = session_data.get("user_profile", {})
        history = session_data.get("history", [])

        # Process RAG Turn
        rag_result = process_rag_turn(
            user_query=user_message,
            user_profile=user_profile,
            history=history,
            top_k=top_k,
        )

        agent_msg = rag_result.get("agentMessage", "Here are the top matching products from our catalog:")
        products = rag_result.get("products", [])

        # Format recommendations list of dicts with parent_asin
        recommendations = []
        for p in products[:top_k]:
            parent_asin = p.get("parent_asin") or p.get("asin")
            if parent_asin:
                recommendations.append({"parent_asin": parent_asin})

        # Infer asked attribute if clarifying
        ask_attr = None
        if rag_result.get("shouldClarify"):
            msg_lower = agent_msg.lower()
            if "color" in msg_lower:
                ask_attr = "color"
            elif "size" in msg_lower or "fit" in msg_lower:
                ask_attr = "size"
            elif "material" in msg_lower or "fabric" in msg_lower:
                ask_attr = "material"
            elif "style" in msg_lower or "design" in msg_lower:
                ask_attr = "style"
            elif "brand" in msg_lower:
                ask_attr = "brand"
            elif "category" in msg_lower or "type" in msg_lower:
                ask_attr = "category"
            else:
                ask_attr = "other"

        # Update history
        history.append({"role": "user", "content": user_message})
        history.append({"role": "assistant", "content": agent_msg})
        session_data["turn_count"] = turn

        return {
            "message": agent_msg,
            "ask_attribute": ask_attr,
            "recommendations": recommendations,
            "usage": {"prompt_tokens": 150, "completion_tokens": 80},
        }
