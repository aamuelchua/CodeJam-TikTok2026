"""
Dual-track retriever: BM25 (sparse) + SentenceTransformer (dense) with RRF merge.
All indices are kept in-memory (numpy arrays for dense vectors).
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any

import numpy as np
from rank_bm25 import BM25Okapi
from sentence_transformers import SentenceTransformer

_DENSE_MODEL_NAME = "all-MiniLM-L6-v2"
_RRF_K = 60  # RRF constant


@dataclass
class Product:
    asin: str
    title: str
    category: str
    price: float | None = None
    features: str | None = None
    description: str | None = None

    @property
    def corpus_text(self) -> str:
        parts = [self.title, self.category]
        if self.features:
            parts.append(self.features)
        if self.description:
            parts.append(self.description)
        return " ".join(parts)

    @property
    def tokens(self) -> list[str]:
        return self.corpus_text.lower().split()


@dataclass
class InMemoryIndex:
    products: list[Product] = field(default_factory=list)
    bm25: BM25Okapi | None = None
    dense_model: SentenceTransformer | None = None
    dense_matrix: np.ndarray | None = None  # shape (N, D)

    def build(self, products: list[Product]) -> None:
        self.products = products
        corpus = [p.tokens for p in products]
        self.bm25 = BM25Okapi(corpus)

        if self.dense_model is None:
            self.dense_model = SentenceTransformer(_DENSE_MODEL_NAME)

        texts = [p.corpus_text for p in products]
        self.dense_matrix = self.dense_model.encode(
            texts, batch_size=64, normalize_embeddings=True, show_progress_bar=False
        ).astype(np.float32)

    def is_ready(self) -> bool:
        return self.bm25 is not None and self.dense_matrix is not None


# Module-level singleton index
_index = InMemoryIndex()


def get_index() -> InMemoryIndex:
    return _index


def load_products(products: list[dict[str, Any]]) -> None:
    """Convert raw dicts from Prisma into Product objects and build indices."""
    parsed = [
        Product(
            asin=p["asin"],
            title=p["title"],
            category=p["category"],
            price=p.get("price"),
            features=p.get("features"),
            description=p.get("description"),
        )
        for p in products
    ]
    _index.build(parsed)


# ---------------------------------------------------------------------------
# Core retrieval helpers
# ---------------------------------------------------------------------------

def _bm25_retrieve(query: str, top_k: int = 100) -> list[tuple[int, float]]:
    """Return (doc_idx, score) pairs sorted descending."""
    idx = get_index()
    if not idx.is_ready():
        return []
    tokens = query.lower().split()
    scores = idx.bm25.get_scores(tokens)
    ranked = sorted(enumerate(scores), key=lambda x: -x[1])
    return ranked[:top_k]


def _dense_retrieve(query: str, top_k: int = 100) -> list[tuple[int, float]]:
    """Return (doc_idx, cosine_sim) pairs sorted descending."""
    idx = get_index()
    if not idx.is_ready():
        return []
    q_vec = idx.dense_model.encode(
        [query], normalize_embeddings=True, show_progress_bar=False
    ).astype(np.float32)
    sims = (idx.dense_matrix @ q_vec.T).flatten()
    ranked = sorted(enumerate(sims.tolist()), key=lambda x: -x[1])
    return ranked[:top_k]


def _rrf_merge(
    bm25_results: list[tuple[int, float]],
    dense_results: list[tuple[int, float]],
    k: int = _RRF_K,
) -> list[tuple[int, float]]:
    """Reciprocal Rank Fusion of two ranked lists. Returns (doc_idx, rrf_score)."""
    scores: dict[int, float] = {}

    for rank, (doc_idx, _) in enumerate(bm25_results):
        scores[doc_idx] = scores.get(doc_idx, 0.0) + 1.0 / (k + rank + 1)

    for rank, (doc_idx, _) in enumerate(dense_results):
        scores[doc_idx] = scores.get(doc_idx, 0.0) + 1.0 / (k + rank + 1)

    merged = sorted(scores.items(), key=lambda x: -x[1])
    return merged


def retrieve(
    query: str,
    intent_track: str = "BUYING",
    hard_filters: dict | None = None,
    negative_filters: list[str] | None = None,
    top_k: int = 100,
) -> list[Product]:
    """
    Main retrieval entry-point.

    - BUYING  → BM25-dominant (weight 70 BM25 / 30 dense)
    - BROWSING → Dense-dominant (30 BM25 / 70 dense)

    Applies hard metadata filters and negative keyword exclusion post-RRF.
    """
    idx = get_index()
    if not idx.is_ready():
        return []

    bm25_top = _bm25_retrieve(query, top_k=top_k)
    dense_top = _dense_retrieve(query, top_k=top_k)

    # Duplicate lists based on intent track weighting
    if intent_track == "BUYING":
        bm25_weighted = bm25_top * 2 + bm25_top  # 3× weight equivalent via list duplication
        dense_weighted = dense_top
    else:
        bm25_weighted = bm25_top
        dense_weighted = dense_top * 2 + dense_top

    merged = _rrf_merge(bm25_weighted, dense_weighted)

    results: list[Product] = []
    neg_lower = [n.lower() for n in (negative_filters or [])]

    for doc_idx, _ in merged:
        if doc_idx >= len(idx.products):
            continue
        product = idx.products[doc_idx]

        # Hard filter: category
        if hard_filters:
            cat = hard_filters.get("category")
            if cat and cat.lower() not in product.category.lower():
                continue
            max_price = hard_filters.get("max_price")
            if max_price and product.price and product.price > float(max_price):
                continue
            min_price = hard_filters.get("min_price")
            if min_price and product.price and product.price < float(min_price):
                continue

        # Negative filter: exclude if any negative term in corpus text
        text_lower = product.corpus_text.lower()
        if any(neg in text_lower for neg in neg_lower):
            continue

        results.append(product)
        if len(results) >= top_k:
            break

    return results
