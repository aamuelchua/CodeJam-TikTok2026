"""
Intent router: classifies user intent as BUYING or BROWSING
and selects the appropriate retrieval strategy.

- BUYING  (high intent): BM25-dominant fast precision ranking
- BROWSING (low intent): Dense-vector semantic retrieval
"""
from __future__ import annotations

import re

_BUYING_SIGNALS = [
    r"\bunder\s+\$?\d+",
    r"\bmax\s+\$?\d+",
    r"\bbrand\b",
    r"\bexactly\b",
    r"\bspecific\b",
    r"\bwant to buy\b",
    r"\bpurchase\b",
    r"\border\b",
    r"\bget me\b",
    r"\bi need\b",
]

_BROWSING_SIGNALS = [
    r"\bshow me\b",
    r"\bwhat.*recommend\b",
    r"\bbrowse\b",
    r"\bexplore\b",
    r"\bsomething like\b",
    r"\bsimilar to\b",
    r"\bideas\b",
    r"\bsuggestion\b",
]


def classify_intent(user_message: str, current_track: str = "BROWSING") -> str:
    """
    Rule-based intent classification with LLM slot fallback.
    Returns "BUYING" or "BROWSING".
    """
    msg_lower = user_message.lower()

    buying_score = sum(1 for p in _BUYING_SIGNALS if re.search(p, msg_lower))
    browsing_score = sum(1 for p in _BROWSING_SIGNALS if re.search(p, msg_lower))

    if buying_score > browsing_score:
        return "BUYING"
    if browsing_score > buying_score:
        return "BROWSING"
    # Tie → preserve current track
    return current_track
