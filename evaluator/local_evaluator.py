from __future__ import annotations

import json
import os
import sys
import time
from typing import Any

# Ensure project root in python path
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from starter.agent import Agent


def run_evaluation(
    public_set_path: str = "data/public_set.jsonl",
    output_results_path: str = "results.json",
    max_turns: int = 10,
    top_k: int = 10,
):
    print(f"=== Starting Local Evaluator on {public_set_path} ===")
    start_time = time.time()

    if not os.path.exists(public_set_path):
        # Fallback to backend/app/data/public_set.jsonl if root path missing
        fallback = "backend/app/data/public_set.jsonl"
        if os.path.exists(fallback):
            public_set_path = fallback
        else:
            raise FileNotFoundError(f"Public set dataset not found at {public_set_path}")

    sessions = []
    with open(public_set_path, "r", encoding="utf-8") as f:
        for line in f:
            if line.strip():
                sessions.append(json.loads(line))

    print(f"Loaded {len(sessions)} evaluation sessions.")
    agent = Agent()

    hits = 0
    mrr_sum = 0.0
    mttc_sum = 0.0
    session_results = []

    for idx, session in enumerate(sessions):
        session_id = session.get("session_id", f"session_{idx+1}")
        user_profile = session.get("user_profile", {})
        target_asin = session.get("target_parent_asin") or session.get("target_asin") or session.get("parent_asin")
        messages = session.get("messages", session.get("turns", []))

        agent.reset(session_id, user_profile)

        hit = False
        hit_turn = 11
        first_rr = 0.0

        # Simulate turns
        turn_num = 1
        for msg_item in messages:
            if turn_num > max_turns or hit:
                break

            user_msg = msg_item if isinstance(msg_item, str) else msg_item.get("content", "")
            if not user_msg:
                continue

            resp = agent.respond(session_id, user_msg, turn=turn_num, top_k=top_k)
            recs = resp.get("recommendations", [])

            # Check if target ASIN is in recommended parent_asins
            rec_asins = [r.get("parent_asin") for r in recs if r.get("parent_asin")]

            if target_asin and target_asin in rec_asins:
                rank = rec_asins.index(target_asin) + 1
                hit = True
                hit_turn = turn_num
                first_rr = 1.0 / rank
                break

            turn_num += 1

        if hit:
            hits += 1
            mrr_sum += first_rr
            mttc_sum += hit_turn
        else:
            mttc_sum += 11

        session_results.append({
            "session_id": session_id,
            "hit": hit,
            "hit_turn": hit_turn if hit else None,
            "mrr": first_rr,
            "target_asin": target_asin,
        })

    total_sessions = len(sessions) if sessions else 1
    hit_rate = hits / total_sessions
    mrr = mrr_sum / total_sessions
    mttc = mttc_sum / total_sessions
    efficiency = max(0.0, min(1.0, (11.0 - mttc) / 10.0))
    technical_score = (0.50 * hit_rate) + (0.30 * mrr) + (0.20 * efficiency)

    summary = {
      "hit_rate_at_10": round(hit_rate, 4),
      "mrr": round(mrr, 6),
      "mttc": round(mttc, 2),
      "efficiency": round(efficiency, 4),
      "technical_score": round(technical_score, 5),
      "total_sessions": total_sessions,
      "elapsed_seconds": round(time.time() - start_time, 2),
    }

    print("\n=== Evaluation Complete ===")
    print(f"Hit Rate@10: {summary['hit_rate_at_10']}")
    print(f"MRR:        {summary['mrr']}")
    print(f"MTTC:       {summary['mttc']}")
    print(f"Tech Score: {summary['technical_score']}")
    print(f"Elapsed:    {summary['elapsed_seconds']}s")

    with open(output_results_path, "w", encoding="utf-8") as f:
        json.dump({"summary": summary, "sessions": session_results}, f, indent=2)

    print(f"Results written to {output_results_path}")
    return summary


if __name__ == "__main__":
    run_evaluation()
