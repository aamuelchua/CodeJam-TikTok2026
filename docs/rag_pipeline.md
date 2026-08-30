# 🛒 Shopping Copilot — Entropy-Driven RAG Pipeline Architecture

This document provides a detailed technical specification of the **Entropy-Driven Conversational RAG (Retrieval-Augmented Generation) Pipeline** built for the **Shopping Copilot (CodeJam / TechJam 2026)** conversational search and recommendation system.

---

## 1. System Overview

The Shopping Copilot addresses the fundamental challenges of e-commerce conversational search:
- **Query Ambiguity**: Users often start with broad, under-specified requests (e.g., *"shoes"*).
- **Dynamic Intent Evolution**: Users shift preferences across interaction turns, requiring active slot tracking and slot overriding (*"actually, not red, show me blue canvas"*).
- **Precision vs. Latency**: Navigating a catalog of **50,000 products** within sub-second response times while delivering top-1 recommendation accuracy.

### Core Pipeline Flow

```
                                User Input
                                    │
                                    ▼
                     ┌──────────────────────────────┐
                     │ Dual-Track Intent Classifier │  (backend/app/core/router.py)
                     └──────────────┬───────────────┘
                                    │
                      ┌─────────────┴─────────────┐
                      ▼                           ▼
                BUYING Track               BROWSING Track
            (BM25 dominant: 0.85)      (Dense vector dominant: 0.50)
                      │                           │
                      └─────────────┬─────────────┘
                                    │
                                    ▼
                     ┌──────────────────────────────┐
                     │ Conversational State Machine │  (backend/app/core/state_machine.py)
                     │    (LLM Slot & Override)     │  (llama3.1:8b)
                     └──────────────┬───────────────┘
                                    │
                                    ▼
                     ┌──────────────────────────────┐
                     │   Multi-Route Hybrid RAG     │  (backend/app/core/retriever.py)
                     │  ├─ BM25 Sparse Search       │
                     │  └─ FAISS Dense Search       │
                     └──────────────┬───────────────┘
                                    │
                                    ▼
                     ┌──────────────────────────────┐
                     │ Reciprocal Rank Fusion (RRF) │  (starter/agent.py)
                     │   + Title Overlap Scoring    │
                     └──────────────┬───────────────┘
                                    │
                                    ▼
                     ┌──────────────────────────────┐
                     │ Dynamic Entropy Check        │  (backend/app/core/entropy.py)
                     │ Pool > 100 & H > 1.5 nats?   │
                     └───────┬──────────────┬───────┘
                          YES│              │NO (Pool ≤ 30 or Turn ≥ 3)
                             ▼              ▼
                    ┌────────────────┐ ┌────────────────────────────────┐
                    │ Proactive      │ │ Cross-Encoder Reranker         │  (backend/app/core/reranker.py)
                    │ Clarification  │ │ (ms-marco-MiniLM-L-6-v2)       │
                    └────────────────┘ └──────────────┬─────────────────┘
                                                      │
                                                      ▼
                                              Top-10 Recommendations
```

---

## 2. Pipeline Components

### 2.1 Dual-Track Intent Router (`router.py`)
- **Location**: [`backend/app/core/router.py`](file:///Users/aamuelchua/Documents/GitHub/CodeJam-TikTok2026/backend/app/core/router.py)
- **Role**: Analyzes query intent to split traffic into two dedicated retrieval strategies:
  - **`BUYING` Track**: High-intent queries containing specific budget, brand, size, or model constraints. Prioritizes keyword precision.
  - **`BROWSING` Track**: Open-ended exploratory queries (*"show me recommendations"*). Prioritizes conceptual vector similarity.

### 2.2 Active State Machine & Slot Extraction (`state_machine.py`)
- **Location**: [`backend/app/core/state_machine.py`](file:///Users/aamuelchua/Documents/GitHub/CodeJam-TikTok2026/backend/app/core/state_machine.py)
- **Model**: `llama3.1:8b` via LangChain `ChatOpenAI` endpoint.
- **Maintained State**:
  - `intentTrack`: `"BUYING"` | `"BROWSING"`
  - `hardFilters`: Category, max/min price, brand.
  - `negativeFilters`: Terms to explicitly exclude.
  - `softPreferences`: Desired attributes.
- **Intent Override Logic**: When the model detects a correction or negation (*"actually not leather"*), conflicting historical slots are automatically erased and moved to `negativeFilters` to prevent preference drift.

### 2.3 Hybrid Retrieval & Reciprocal Rank Fusion (RRF) (`retriever.py` / `agent.py`)
- **Location**: [`backend/app/core/retriever.py`](file:///Users/aamuelchua/Documents/GitHub/CodeJam-TikTok2026/backend/app/core/retriever.py) & [`starter/agent.py`](file:///Users/aamuelchua/Documents/GitHub/CodeJam-TikTok2026/starter/agent.py)
- **Sparse Retrieval**: `Rank-BM25` over normalized tokens across the 50,000 product corpus, with 3x term-frequency title boosting.
- **Dense Retrieval**: `FAISS` vector store powered by `all-MiniLM-L6-v2` embeddings.
- **RRF Equation**:
  $$\text{RRF Score}(d) = \frac{w_{\text{BM25}}}{60 + \text{rank}_{\text{BM25}}(d)} + \frac{w_{\text{Dense}}}{60 + \text{rank}_{\text{Dense}}(d)}$$
  - **Weights**:
    - `BUYING`: $w_{\text{BM25}} = 0.85, w_{\text{Dense}} = 0.15$
    - `BROWSING`: $w_{\text{BM25}} = 0.50, w_{\text{Dense}} = 0.50$
- **Title Overlap Bonus**: Adds an extra precision boost based on exact query token overlap in product titles to lock top-1 matching accuracy.

### 2.4 Entropy-Driven Proactive Guidance (`entropy.py`)
- **Location**: [`backend/app/core/entropy.py`](file:///Users/aamuelchua/Documents/GitHub/CodeJam-TikTok2026/backend/app/core/entropy.py)
- **Concept**: Measures Shannon Categorical Entropy across dominant product attributes in the candidate pool:
  $$H(X) = -\sum_{i} P(x_i) \log P(x_i)$$
- **Trigger Conditions**:
  - **Clarification Trigger**: Candidate Pool $> 100$ and $H \ge 1.5\text{ nats} \implies$ Halt retrieval and issue attribute-targeted clarification question (category, price range, brand).
  - **Pass-through Condition**: Candidate Pool $\le 30$ or Turn $\ge 3 \implies$ Proceed directly to reranking.

### 2.5 Cross-Encoder Reranker (`reranker.py`)
- **Location**: [`backend/app/core/reranker.py`](file:///Users/aamuelchua/Documents/GitHub/CodeJam-TikTok2026/backend/app/core/reranker.py)
- **Model**: `cross-encoder/ms-marco-MiniLM-L-6-v2`
- **Function**: Performs heavy semantic pairwise re-scoring of $(Query, Candidate)$ for the top RRF candidates to select the final Top-10 recommendations.

---

## 3. Benchmark Performance Results

Evaluated using the official test harness ([`evaluator/local_evaluator.py`](file:///Users/aamuelchua/Documents/GitHub/CodeJam-TikTok2026/evaluator/local_evaluator.py)) over **200 evaluation sessions**:

| Metric | Baseline Starter Agent | Our Implemented RAG Pipeline | Absolute Improvement | Relative Improvement |
| :--- | :---: | :---: | :---: | :---: |
| **Hit Rate@10** | `0.1250` (12.5%) | **`0.9950` (99.50%)** | **+87.00%** | **+696.0%** |
| **MRR (Mean Reciprocal Rank)** | `0.0680` (6.8%) | **`0.9875` (98.75%)** | **+91.95%** | **~14.5x** |
| **MTTC (Mean Turns to Conversion)** | `9.81` turns | **`1.05` turns** | **-8.76 turns** | **89.3% reduction** |
| **Efficiency Score** | `0.1190` (11.9%) | **`0.9950` (99.50%)** | **+87.60%** | **~8.36x** |
| **Technical Score** | `0.1066` (10.66%) | **`0.9928` (99.28%)** | **+88.62%** | **~9.31x** |
| **Execution Time** | — | **`45.92` seconds** | — | **~0.23s / session** |

### Official Metric Formula

$$\text{Technical Score} = 0.50 \times \text{HitRate@10} + 0.30 \times \text{MRR} + 0.20 \times \text{Efficiency}$$

$$\text{Technical Score} = 0.50(0.9950) + 0.30(0.9875) + 0.20(0.9950) = \mathbf{0.99275}$$

---

## 4. Execution & Verification

Run the local evaluation suite to reproduce the results:

```bash
# Run local evaluator
./run_eval.sh
```

Results are stored in [`results.json`](file:///Users/aamuelchua/Documents/GitHub/CodeJam-TikTok2026/results.json).
