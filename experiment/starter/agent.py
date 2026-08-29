from __future__ import annotations

from pathlib import Path
from typing import Any
from starter.rag_pipeline import (
    RAGPipeline,
    detect_intent,
    process_rag_turn,
    get_vectorstore,
    get_llm,
    get_embedding_model,
    load_full_catalog,
    get_bm25_index,
    _clean_tokens,
)


class Agent:
    """
    Unified RAG Execution Agent in starter package.
    Delegates pipeline execution directly to starter.rag_pipeline.RAGPipeline.
    """

    def __init__(self, catalog_path: str | Path = "data/catalog.jsonl") -> None:
        self.pipeline = RAGPipeline(catalog_path=catalog_path)
        self.products = self.pipeline.products
        self.connection = self.pipeline.connection

    def reset(self, session_id: str, user_profile: dict) -> None:
        self.pipeline.reset_session(session_id, user_profile)

    def respond(
        self,
        session_id: str,
        user_message: str,
        turn: int,
        top_k: int,
    ) -> dict[str, Any]:
        return self.pipeline.execute_turn(session_id, user_message, turn, top_k)


__all__ = [
    "Agent",
    "detect_intent",
    "process_rag_turn",
    "get_vectorstore",
    "get_llm",
    "get_embedding_model",
    "load_full_catalog",
    "get_bm25_index",
    "_clean_tokens",
]
