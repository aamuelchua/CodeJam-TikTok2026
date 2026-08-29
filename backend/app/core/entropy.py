"""
Entropy calculation and clarification-trigger logic.

After candidate retrieval, we measure attribute variance in the pool to
decide whether we should halt and ask a clarifying question instead of
returning products.

Trigger condition (from spec):
  - CandidatePool > 100 AND variance across dominant attributes is HIGH
Exit condition:
  - CandidatePool <= 30 OR Turn >= 3  → run reranker and return Top-10
"""
from __future__ import annotations

import math
from collections import Counter
from dataclasses import dataclass

from .retriever import Product

# Minimum entropy threshold above which we consider variance "high"
_HIGH_ENTROPY_THRESHOLD = 1.5  # nats


@dataclass
class EntropyResult:
    entropy_score: float
    should_clarify: bool
    clarification_attr: str | None
    clarification_question: str | None


def _categorical_entropy(values: list[str]) -> float:
    """Shannon entropy (nats) of a categorical attribute distribution."""
    n = len(values)
    if n == 0:
        return 0.0
    counts = Counter(values)
    entropy = 0.0
    for count in counts.values():
        p = count / n
        entropy -= p * math.log(p)
    return entropy


def _price_bucket(price: float | None) -> str:
    if price is None:
        return "unknown"
    if price < 20:
        return "budget"
    if price < 60:
        return "mid-range"
    if price < 150:
        return "premium"
    return "luxury"


def compute_entropy(
    candidates: list[Product],
    turn_number: int,
) -> EntropyResult:
    """
    Compute pool entropy and decide whether to request clarification.

    Returns an EntropyResult with:
      - entropy_score: weighted average entropy across candidate attributes
      - should_clarify: True when spec trigger conditions are met
      - clarification_attr: attribute with highest entropy
      - clarification_question: a human-readable question to ask the user
    """
    n = len(candidates)

    # --- Exit condition: pool small enough or turn limit reached ---
    if n <= 30 or turn_number >= 3:
        return EntropyResult(
            entropy_score=0.0,
            should_clarify=False,
            clarification_attr=None,
            clarification_question=None,
        )

    # --- Compute per-attribute entropy ---
    attrs: dict[str, list[str]] = {
        "category": [p.category for p in candidates],
        "price_range": [_price_bucket(p.price) for p in candidates],
    }

    entropy_by_attr: dict[str, float] = {}
    for attr, values in attrs.items():
        entropy_by_attr[attr] = _categorical_entropy(values)

    # Overall entropy = mean across attributes
    avg_entropy = sum(entropy_by_attr.values()) / max(len(entropy_by_attr), 1)

    # Highest-entropy attribute → best to clarify on
    top_attr = max(entropy_by_attr, key=lambda a: entropy_by_attr[a])
    top_entropy = entropy_by_attr[top_attr]

    # --- Trigger condition ---
    should_clarify = n > 100 and top_entropy >= _HIGH_ENTROPY_THRESHOLD

    clarification_question = None
    if should_clarify:
        clarification_question = _build_question(top_attr, candidates)

    return EntropyResult(
        entropy_score=round(avg_entropy, 4),
        should_clarify=should_clarify,
        clarification_attr=top_attr if should_clarify else None,
        clarification_question=clarification_question,
    )


def _build_question(attr: str, candidates: list[Product]) -> str:
    """Build a targeted clarification question for the highest-entropy attribute."""
    if attr == "category":
        categories = list({p.category for p in candidates})[:5]
        options = ", ".join(f'"{c}"' for c in categories)
        return (
            f"I found products across several categories ({options}, and more). "
            "Could you tell me which category you're interested in?"
        )
    if attr == "price_range":
        return (
            "The results span a wide price range. "
            "Are you looking for something budget-friendly (under $20), "
            "mid-range ($20–$60), premium ($60–$150), or luxury ($150+)?"
        )
    return "Could you give me a bit more detail about what you're looking for?"
