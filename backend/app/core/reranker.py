"""
Cross-Encoder reranker using ms-marco-MiniLM-L-6-v2.
Re-ranks the top-30 RRF candidates against the user query.
"""
from __future__ import annotations

from sentence_transformers import CrossEncoder

from .retriever import Product

_CE_MODEL_NAME = "cross-encoder/ms-marco-MiniLM-L-6-v2"
_ce_model: CrossEncoder | None = None


def _get_cross_encoder() -> CrossEncoder:
    global _ce_model
    if _ce_model is None:
        _ce_model = CrossEncoder(_CE_MODEL_NAME)
    return _ce_model


def rerank(query: str, candidates: list[Product], top_k: int = 10) -> list[Product]:
    """
    Score each candidate (query, passage) pair with the cross-encoder.
    Returns the top_k products sorted by descending score.
    """
    if not candidates:
        return []

    ce = _get_cross_encoder()
    passages = [p.corpus_text for p in candidates]
    pairs = [(query, passage) for passage in passages]

    scores = ce.predict(pairs)
    ranked = sorted(zip(scores, candidates), key=lambda x: -x[0])
    return [prod for _, prod in ranked[:top_k]]
