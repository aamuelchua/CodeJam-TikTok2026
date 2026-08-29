# 🛒 Shopping Copilot — Entropy-Driven Conversational Commerce

An **Active State-Machine Agent** for e-commerce search and recommendation built for the **CodeJam / TechJam 2026 Hackathon**.  
It features **Dual-Track Intent Routing**, **LLM Slot Tracking & Intent Override**, **BM25 + FAISS Dense Embedding Reciprocal Rank Fusion (RRF)**, **Entropy-based Clarification Triggers**, and **Cross-Encoder Reranking**.

> 📖 **Full Pipeline Documentation**: Detailed architectural breakdown, mathematical formulation, and sub-component specs are available in [`docs/rag_pipeline.md`](docs/rag_pipeline.md).

---

## 📊 Benchmark Performance & Results

Evaluated using the official local benchmark dataset of **200 public test sessions**:

| Metric | Baseline Starter Agent | Our Implemented RAG Pipeline | Absolute Improvement |
| :--- | :---: | :---: | :---: |
| **Hit Rate@10** | `0.1250` (12.5%) | **`0.9950` (99.50%)** | **+87.00%** |
| **MRR (Mean Reciprocal Rank)** | `0.0680` (6.8%) | **`0.9875` (98.75%)** | **+91.95%** |
| **MTTC (Mean Turns to Conversion)** | `9.81` turns | **`1.05` turns** | **-8.76 turns** |
| **Efficiency Score** | `0.1190` (11.9%) | **`0.9950` (99.50%)** | **+87.60%** |
| **Technical Score** | `0.1066` (10.66%) | **`0.9928` (99.28%)** | **+88.62%** |
| **Total Evaluation Time** | — | **`45.92` seconds** | **~0.23s / session** |

---

## 🚀 Quick Start

### Prerequisites

| Tool | Version |
|------|---------|
| Python | ≥ 3.10 |
| Node.js | ≥ 18 |
| Ollama | latest |

Pull the required Ollama model:
```bash
ollama pull llama3.1:8b
```

---

### Running Evaluation Benchmark

To execute the local evaluator on the 200 public test sessions:

```bash
./run_eval.sh
```

Results are saved to `results.json`.

---

### Backend Setup

```bash
# 1. Navigate to backend
cd backend

# 2. Create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate

# 3. Install Python dependencies
pip install -r requirements.txt

# 4. Copy the Prisma schema into the app folder
cp schema.prisma app/schema.prisma

# 5. Generate the Prisma client
prisma generate --schema=schema.prisma

# 6. Push the schema to create the SQLite database
prisma db push --schema=schema.prisma

# 7. Start the FastAPI server
python run.py
```

The API will be live at **http://localhost:8000**  
Interactive OpenAPI Docs: **http://localhost:8000/docs**

---

### Frontend Setup

```bash
# 1. Navigate to frontend
cd frontend

# 2. Install dependencies
npm install

# 3. Start the Vite dev server
npm run dev
```

The UI will be available at **http://localhost:3000**

---

## 🏗️ Pipeline Architecture Overview

```
User Message
    │
    ▼
Intent Router (classify_intent) ──► BUYING / BROWSING Track
    │
    ▼
State Machine (Ollama llama3.1:8b)
  → Extract: hardFilters, negativeFilters, softPreferences
  → Apply Intent Overrides & Erasure
    │
    ▼
Retriever (RRF)
  ├─ BM25 (rank-bm25 with 3x title boosting)
  └─ Dense (all-MiniLM-L6-v2 + FAISS)
    │
    ▼
Entropy Check (Shannon Categorical Entropy)
  ├─ Pool > 100 & H > 1.5 → Proactive Clarification Question
  └─ Pool ≤ 30 or Turn ≥ 3 → Cross-Encoder Reranker (ms-marco-MiniLM-L-6-v2)
                                      │
                                      ▼
                              Top-10 Recommendations
```

---

## 🌐 API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/sessions` | Create a new shopping session |
| `POST` | `/api/sessions/{id}/turn` | Process a conversational turn |
| `GET`  | `/api/sessions/{id}/state` | Inspect current slot state |
| `POST` | `/api/products/load` | Load products into search index |
| `GET`  | `/health` | Health check |

---

## 📂 Project Structure

```
backend/
├── app/
│   ├── api/routes.py          # FastAPI endpoints
│   ├── core/
│   │   ├── state_machine.py   # Slot tracking & LLM override logic
│   │   ├── router.py          # Buying vs Browsing intent routing
│   │   ├── retriever.py       # In-memory BM25 + Dense RRF
│   │   ├── entropy.py         # Variance calculation & cutoff logic
│   │   ├── reranker.py        # Cross-Encoder Top-30 reranking
│   │   └── rag_pipeline.py    # Pipeline interface module
│   ├── db/prisma.py           # Prisma client lifecycle
│   └── main.py                # FastAPI entrypoint
├── schema.prisma              # Prisma schema definition
├── requirements.txt
└── run.py
docs/
├── rag_pipeline.md            # Detailed RAG Architecture Documentation
├── baseline_results.json      # Weak starter baseline metric outputs
└── evaluation_config.json     # Evaluator parameters
starter/
└── agent.py                   # Unified RAG execution agent
evaluator/
└── local_evaluator.py         # Official benchmark evaluation script
frontend/
├── src/
│   ├── components/
│   │   ├── ChatPlayground.jsx # Conversational UI
│   │   ├── StateInspector.jsx # Real-time slot debugger
│   │   └── ProductGrid.jsx    # Ranked product cards
│   ├── App.jsx                # 3-panel layout
│   └── index.jsx
└── vite.config.js
```