#!/usr/bin/env python3
"""
Test Data Generator for E-commerce RAG Evaluation.
Samples randomized datasets from catalog.jsonl with configurable scenario mixtures,
seeds, and sample sizes, maintaining strict compatibility with evaluator.local_evaluator.
"""
from __future__ import annotations

import argparse
import json
import random
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent


def coarse_category(values: list[str]) -> str:
    excluded = {"clothing", "clothing shoes & jewelry", "clothing, shoes & jewelry"}
    cleaned: list[str] = []
    for value in values:
        for part in value.split(","):
            part = part.strip()
            if part and part.lower() not in excluded:
                cleaned.append(part)
    return " ".join(cleaned[-2:]) if cleaned else "clothing item"


PREFERENCE_TAG_POOL = [
    "fit", "comfort", "material", "style", "durability",
    "performance", "warmth", "weather", "breathability", "versatility"
]

RATING_STYLES = [
    (0.65, "usually positive", 5.0),
    (0.15, "usually positive", 4.0),
    (0.10, "mixed", 3.0),
    (0.05, "critical", 2.0),
    (0.05, "critical", 1.0),
]


def generate_user_profile(rng: random.Random) -> dict:
    r = rng.random()
    cumulative = 0.0
    style = "usually positive"
    prior_rating = 5.0
    for threshold, s, rating in RATING_STYLES:
        cumulative += threshold
        if r <= cumulative:
            style = s
            prior_rating = rating
            break

    num_tags = rng.randint(2, 4)
    tags = rng.sample(PREFERENCE_TAG_POOL, num_tags)
    tag_str = ", ".join(tags)
    return {
        "average_prior_rating": prior_rating,
        "preference_tags": tags,
        "purchase_frequency": "3-4 prior purchases",
        "rating_style": style,
        "summary": f"Prior purchases emphasize {tag_str}; ratings are {style}."
    }


def build_scenario_list(size: int, mixture: str, rng: random.Random) -> list[str]:
    if mixture == "buying_heavy":
        counts = {
            "buying": int(size * 0.65),
            "browsing": int(size * 0.20),
            "intent_override": int(size * 0.10),
            "boundary": size - int(size * 0.65) - int(size * 0.20) - int(size * 0.10),
        }
    elif mixture == "browsing_heavy":
        counts = {
            "browsing": int(size * 0.65),
            "buying": int(size * 0.15),
            "intent_override": int(size * 0.15),
            "boundary": size - int(size * 0.65) - int(size * 0.15) - int(size * 0.15),
        }
    elif mixture == "override_heavy":
        counts = {
            "intent_override": int(size * 0.45),
            "buying": int(size * 0.25),
            "browsing": int(size * 0.25),
            "boundary": size - int(size * 0.45) - int(size * 0.25) - int(size * 0.25),
        }
    else:  # standard competition distribution (40% buying, 40% browsing, 15% override, 5% boundary)
        counts = {
            "buying": int(size * 0.40),
            "browsing": int(size * 0.40),
            "intent_override": int(size * 0.15),
            "boundary": size - int(size * 0.40) - int(size * 0.40) - int(size * 0.15),
        }

    scenarios = []
    for sc, count in counts.items():
        scenarios.extend([sc] * count)
    rng.shuffle(scenarios)
    return scenarios


def generate_dataset(
    catalog_path: Path,
    output_path: Path,
    size: int = 200,
    seed: int = 42,
    mixture: str = "standard",
    exclude_asins: set[str] | None = None,
) -> None:
    rng = random.Random(seed)
    products: list[dict] = []

    with catalog_path.open(encoding="utf-8") as f:
        for line in f:
            if line.strip():
                p = json.loads(line)
                asin = str(p.get("parent_asin", ""))
                if exclude_asins and asin in exclude_asins:
                    continue
                # Ensure title and categories exist for valid testing
                if p.get("title") and p.get("categories"):
                    products.append(p)

    if len(products) < size:
        raise ValueError(f"Catalog has only {len(products)} products, requested {size}")

    selected = rng.sample(products, size)
    scenarios = build_scenario_list(size, mixture, rng)

    difficulty_map = {
        "buying": "easy",
        "browsing": "medium",
        "intent_override": "hard",
        "boundary": "medium",
    }

    samples: list[dict] = []
    for idx, (prod, scenario) in enumerate(zip(selected, scenarios), 1):
        asin = str(prod["parent_asin"])
        cats = [str(c) for c in (prod.get("categories") or [])]
        cat = coarse_category(cats)
        title = str(prod.get("title") or "")
        profile = generate_user_profile(rng)

        sample = {
            "category_bucket": "clothing",
            "difficulty_bucket": difficulty_map.get(scenario, "medium"),
            "ground_truth": {"parent_asin": asin},
            "sample_id": f"test_{mixture[:3]}_{idx:04d}",
            "scenario_type": scenario,
            "user_profile": profile,
            "target_parent_asin": asin,
            "messages": [f"I am looking for a {cat}. {title[:80]}"]
        }
        samples.append(sample)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as f:
        for s in samples:
            f.write(json.dumps(s) + "\n")

    print(f"Successfully generated {len(samples)} test cases in {output_path} (seed={seed}, mixture={mixture})")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate randomized test sets from catalog.jsonl")
    parser.add_argument("--catalog", default=str(ROOT_DIR / "data" / "catalog.jsonl"))
    parser.add_argument("--output", default=str(ROOT_DIR / "test-data" / "test_set_1_standard.jsonl"))
    parser.add_argument("--size", type=int, default=200)
    parser.add_argument("--seed", type=int, default=101)
    parser.add_argument("--mixture", choices=["standard", "buying_heavy", "browsing_heavy", "override_heavy"], default="standard")
    args = parser.parse_args()

    generate_dataset(
        catalog_path=Path(args.catalog),
        output_path=Path(args.output),
        size=args.size,
        seed=args.seed,
        mixture=args.mixture,
    )


if __name__ == "__main__":
    main()
