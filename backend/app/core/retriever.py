"""
Dual-track retriever: BM25 (sparse) + SentenceTransformer (dense) with RRF merge.
Supports user profile vector embeddings and full catalog schema.
"""
from __future__ import annotations

import json
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
    features: str | list[str] | None = None
    description: str | list[str] | None = None
    parent_asin: str | None = None
    average_rating: float | None = 4.5
    rating_number: int | None = 100
    store: str | None = None
    details: dict[str, Any] | str | None = None

    @property
    def features_text(self) -> str:
        if isinstance(self.features, list):
            return " ".join(self.features)
        return self.features or ""

    @property
    def description_text(self) -> str:
        if isinstance(self.description, list):
            return " ".join(self.description)
        return self.description or ""

    @property
    def category_text(self) -> str:
        if isinstance(self.category, list):
            return " > ".join(self.category)
        return self.category or ""

    @property
    def corpus_text(self) -> str:
        parts = [self.title, self.category_text]
        if self.store:
            parts.append(self.store)
        if self.features_text:
            parts.append(self.features_text)
        if self.description_text:
            parts.append(self.description_text)
        return " ".join(parts)

    @property
    def tokens(self) -> list[str]:
        return self.corpus_text.lower().split()

    def to_dict(self) -> dict[str, Any]:
        return {
            "asin": self.asin,
            "parent_asin": self.parent_asin or self.asin,
            "title": self.title,
            "category": self.category_text,
            "categories": self.category if isinstance(self.category, list) else [self.category_text],
            "price": self.price,
            "features": self.features if isinstance(self.features, list) else ([self.features] if self.features else []),
            "description": self.description if isinstance(self.description, list) else ([self.description] if self.description else []),
            "average_rating": self.average_rating if self.average_rating is not None else 4.5,
            "rating_number": self.rating_number if self.rating_number is not None else 120,
            "store": self.store or "Copilot Store",
            "details": self.details if isinstance(self.details, dict) else {},
        }


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
    """Convert raw dicts into Product objects and build indices."""
    parsed = []
    for p in products:
        category_val = p.get("categories") or p.get("category") or "General"
        parsed.append(
            Product(
                asin=p.get("asin") or p.get("parent_asin") or "UNKNOWN",
                parent_asin=p.get("parent_asin"),
                title=p.get("title", "Untitled Product"),
                category=category_val,
                price=p.get("price"),
                features=p.get("features"),
                description=p.get("description"),
                average_rating=p.get("average_rating"),
                rating_number=p.get("rating_number"),
                store=p.get("store"),
                details=p.get("details"),
            )
        )
    _index.build(parsed)


# Default Sample Catalog matching prompt schema
DEFAULT_CATALOG_SEED: list[dict[str, Any]] = [
    {
        "parent_asin": "B08MBM15JB",
        "asin": "B08MBM15JB",
        "title": "Evshine Women's Fuzzy Slippers Cross Band Memory Foam House Slippers Open Toe",
        "features": [
            "Ethylene Vinyl Acetate sole",
            "FASHION & ELEGANT: Breathable Open-toe along with trendy faux fur design makes these womens slippers stylish and practical.",
            "FUZZY HOUSE SLIPPERS: Fuzzy faux fur upper and footbed surrounds your foot in cloud comfort, making your feet cozy.",
            "MEMORY FOAM INSOLE: These house slippers with memory foam mold to the contours of your feet which gives you cozy feeling.",
            "ANTI-SKID SOLE: Durable and soft waterproof rubber soles make these womens slippers great for indoor and outdoor use.",
            "A GOOD GIFT CHOICE: Machine washable house slippers available in several colors."
        ],
        "description": ["High quality memory foam slippers with cozy faux fur."],
        "price": 11.99,
        "categories": ["Clothing, Shoes & Jewelry", "Women", "Shoes", "Slippers"],
        "details": {"Department": "womens", "Date First Available": "October 31, 2020"},
        "average_rating": 4.5,
        "rating_number": 4186,
        "store": "Evshine"
    },
    {
        "parent_asin": "B09X7Y12AA",
        "asin": "B09X7Y12AA",
        "title": "Ultralight Breathable Mens Running Shoes Cushioned Athletic Sneakers",
        "features": [
            "Mesh Breathable Upper: Keeps your feet cool and comfortable during workouts",
            "Cushioned EVA Midsole: Superior shock absorption for high impact running",
            "Non-slip Rubber Outsole: Ensures strong grip on asphalt and track",
            "Lightweight Design: Built for long distance running and everyday walking"
        ],
        "description": ["Ergonomic athletic running shoes engineered for performance."],
        "price": 49.99,
        "categories": ["Clothing, Shoes & Jewelry", "Men", "Shoes", "Athletic"],
        "details": {"Department": "mens", "Material": "Mesh/EVA"},
        "average_rating": 4.7,
        "rating_number": 1820,
        "store": "ApexRun"
    },
    {
        "parent_asin": "B07Z88QWER",
        "asin": "B07Z88QWER",
        "title": "Noise Cancelling True Wireless Earbuds Bluetooth 5.3 with Wireless Charging Case",
        "features": [
            "Active Noise Cancellation (ANC) up to 35dB",
            "30-Hour Total Playtime with compact charging case",
            "IPX7 Waterproof: Protects against sweat and heavy rain",
            "Touch controls for music calls and voice assistant"
        ],
        "description": ["Immersive high-fidelity audio with crystal clear microphones."],
        "price": 39.95,
        "categories": ["Electronics", "Headphones", "Earbuds"],
        "details": {"Connectivity": "Bluetooth 5.3", "Battery": "30 Hrs"},
        "average_rating": 4.6,
        "rating_number": 8920,
        "store": "SoundPulse"
    },
    {
        "parent_asin": "B08K39PLM1",
        "asin": "B08K39PLM1",
        "title": "Ergonomic Mesh Office Chair High Back Desk Chair with Adjustable Lumbar Support",
        "features": [
            "Breathable Mesh Backrest keeps air circulating for all day seating comfort",
            "Dynamic Lumbar Support adjusts automatically to your posture",
            "3D Adjustable Armrests and 135 degree tilt recline capability",
            "Heavy-Duty Metal Base supporting up to 300 lbs"
        ],
        "description": ["Professional office chair designed to relieve back pain."],
        "price": 159.00,
        "categories": ["Home & Kitchen", "Furniture", "Office Chairs"],
        "details": {"Material": "Mesh/Steel", "Weight Limit": "300 lbs"},
        "average_rating": 4.8,
        "rating_number": 2340,
        "store": "ErgoFlex"
    },
    {
        "parent_asin": "B09H22V999",
        "asin": "B09H22V999",
        "title": "Stainless Steel Thermal Espresso & Drip Coffee Maker Combo Machine",
        "features": [
            "15-Bar Italian Pump Espresso extraction system",
            "10-Cup Drip Coffee thermal carafe keeps coffee hot for hours",
            "Integrated Milk Frother for cappuccinos and lattes",
            "Programmable auto-brew 24 hour timer with LCD screen"
        ],
        "description": ["All-in-one coffee station for home barista enthusiasts."],
        "price": 129.50,
        "categories": ["Home & Kitchen", "Appliances", "Coffee Makers"],
        "details": {"Capacity": "10 Cups", "Pump Pressure": "15 Bar"},
        "average_rating": 4.4,
        "rating_number": 950,
        "store": "BaristaPro"
    },
    {
        "parent_asin": "B08N55Z911",
        "asin": "B08N55Z911",
        "title": "Smart Fitness Watch with Heart Rate Monitor Sleep Tracking & GPS",
        "features": [
            "1.43 inch AMOLED Touchscreen HD Display",
            "Continuous 24/7 Heart Rate SpO2 and Sleep Quality Monitor",
            "Built-in GPS for precise outdoors distance and pace tracking",
            "14-Day Long Battery Life on single charge"
        ],
        "description": ["Comprehensive health tracker smartwatch compatible with iOS and Android."],
        "price": 79.99,
        "categories": ["Electronics", "Wearables", "Smartwatches"],
        "details": {"Display": "AMOLED 1.43 inch", "Water Resistance": "5ATM"},
        "average_rating": 4.6,
        "rating_number": 3410,
        "store": "FitPulse"
    },
    {
        "parent_asin": "B07P41MK22",
        "asin": "B07P41MK22",
        "title": "Genuine Italian Leather Tote Bag Handbag for Women Work Laptop Shoulder Bag",
        "features": [
            "100% Genuine Top Grain Cowhide Leather with soft suede interior",
            "Padded 15.6 inch Laptop Sleeve compartment with zippered pockets",
            "Reinforced handles and detachable crossbody shoulder strap",
            "Classic timeless design for work business and daily travel"
        ],
        "description": ["Spacious premium leather tote handcrafted for modern women."],
        "price": 89.00,
        "categories": ["Clothing, Shoes & Jewelry", "Women", "Handbags", "Totes"],
        "details": {"Material": "Genuine Leather", "Fits Laptop": "15.6 Inch"},
        "average_rating": 4.7,
        "rating_number": 1540,
        "store": "ModaLux"
    },
    {
        "parent_asin": "B08T6655FF",
        "asin": "B08T6655FF",
        "title": "Non-Slip Thick Yoga Mat with Alignment Lines & Carrying Strap",
        "features": [
            "6mm Extra Thick High-Density TPE Foam Cushioning",
            "Dual-sided Non-Slip Texture provides firm grip on hardwood floors",
            "Body Alignment Guide Lines help refine pose positions",
            "Eco-friendly non-toxic odor free material"
        ],
        "description": ["Premium exercise yoga mat designed for yoga Pilates and floor workouts."],
        "price": 24.99,
        "categories": ["Sports & Outdoors", "Exercise & Fitness", "Yoga"],
        "details": {"Thickness": "6mm", "Material": "Eco TPE"},
        "average_rating": 4.8,
        "rating_number": 5120,
        "store": "ZenFlow"
    }
]


def load_catalog_file(max_items: int = 500) -> list[dict[str, Any]]:
    """Parse backend/app/data/catalog.jsonl and return parsed product dicts."""
    import os
    file_path = os.path.join(os.path.dirname(__file__), "..", "data", "catalog.jsonl")
    items = []
    if os.path.exists(file_path):
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                for i, line in enumerate(f):
                    if i >= max_items:
                        break
                    line_str = line.strip()
                    if line_str:
                        data = json.loads(line_str)
                        # Fix pricing if None
                        if data.get("price") is None:
                            data["price"] = 19.99
                        items.append(data)
        except Exception:
            pass
    return items


# Ensure index is seeded on module load
if not _index.is_ready():
    catalog_items = load_catalog_file(max_items=500)
    if catalog_items:
        load_products(catalog_items + DEFAULT_CATALOG_SEED)
    else:
        load_products(DEFAULT_CATALOG_SEED)



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


def _dense_retrieve(
    query: str, user_interests: list[str] | None = None, top_k: int = 100
) -> list[tuple[int, float]]:
    """Return (doc_idx, cosine_sim) pairs incorporating query + user profile vector embeddings."""
    idx = get_index()
    if not idx.is_ready():
        return []

    q_vec = idx.dense_model.encode(
        [query], normalize_embeddings=True, show_progress_bar=False
    ).astype(np.float32)

    # Incorporate user interest profile vector embeddings if present
    if user_interests:
        profile_text = " ".join(user_interests)
        p_vec = idx.dense_model.encode(
            [profile_text], normalize_embeddings=True, show_progress_bar=False
        ).astype(np.float32)
        # Weighted combination: 70% current search intent, 30% long-term user profile
        combined_vec = 0.7 * q_vec + 0.3 * p_vec
        # Re-normalize vector
        norm = np.linalg.norm(combined_vec)
        if norm > 0:
            combined_vec = combined_vec / norm
        q_vec = combined_vec

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
    user_interests: list[str] | None = None,
    top_k: int = 100,
) -> list[Product]:
    """
    Main retrieval entry-point.
    Integrates user profile interest vector embeddings with real-time hybrid search.
    """
    idx = get_index()
    if not idx.is_ready():
        return []

    bm25_top = _bm25_retrieve(query, top_k=top_k)
    dense_top = _dense_retrieve(query, user_interests=user_interests, top_k=top_k)

    # Duplicate lists based on intent track weighting
    if intent_track == "BUYING":
        bm25_weighted = bm25_top * 2 + bm25_top
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
            if cat and cat.lower() not in product.category_text.lower():
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

