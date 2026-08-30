"""
LangChain Hybrid RAG Pipeline for Shopping Copilot

Delegates core execution to starter.agent for unified pipeline singletons.
"""
from __future__ import annotations

import os
import sys

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from starter.agent import (
    process_rag_turn,
    get_vectorstore,
    get_llm,
    get_embedding_model,
    load_full_catalog,
    get_bm25_index,
    detect_intent,
    DEFAULT_CATALOG_PATH,
)

__all__ = [
    "process_rag_turn",
    "get_vectorstore",
    "get_llm",
    "get_embedding_model",
    "load_full_catalog",
    "get_bm25_index",
    "detect_intent",
    "DEFAULT_CATALOG_PATH",
]
