# 🛒 Shopping Copilot — Entropy-Driven Conversational Commerce

An **Active State-Machine Agent** for e-commerce search and recommendation.  
BM25 + Dense Embeddings → RRF → Cross-Encoder reranking, with LLM slot extraction and entropy-triggered clarifications.

---

## Quick Start

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

### Backend Setup

```bash
# 1. Navigate to backend
cd backend

# 2. Create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate

# 3. Install Python dependencies
pip install -r requirements.txt

# 4. Copy the Prisma schema into the app folder (required by prisma-client-py)
cp schema.prisma app/schema.prisma

# 5. Generate the Prisma client (run from backend/ or wherever schema.prisma lives)
prisma generate --schema=schema.prisma

# 6. Push the schema to create the SQLite database
prisma db push --schema=schema.prisma

# 7. Start the FastAPI server (hot-reload enabled)
python run.py
```

The API is now available at **http://localhost:8000**  
Interactive docs: **http://localhost:8000/docs**

---

### Frontend Setup

```bash
# Open a new terminal tab

# 1. Navigate to frontend
cd frontend

# 2. Install dependencies
npm install

# 3. Start the Vite dev server
npm run dev
```

The UI is now available at **http://localhost:3000**

---

## Loading Products into the Index

The backend exposes `POST /api/products/load` to seed the in-memory search index.  
Example using curl:

```bash
curl -X POST http://localhost:8000/api/products/load \
  -H "Content-Type: application/json" \
  -d '{
    "products": [
      {
        "asin": "B001234567",
        "title": "Nike Air Zoom Running Shoes",
        "category": "Shoes",
        "price": 89.99,
        "features": "Breathable mesh, cushioned sole, lightweight",
        "description": "Ideal for long-distance running and daily training."
      }
    ]
  }'
```

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/sessions` | Create a new shopping session |
| `POST` | `/api/sessions/{id}/turn` | Process a conversational turn |
| `GET`  | `/api/sessions/{id}/state` | Inspect current slot state |
| `POST` | `/api/products/load` | Load products into search index |
| `GET`  | `/health` | Health check |

---

## Architecture

```
User Message
    │
    ▼
Intent Router (classify_intent) ──► BUYING / BROWSING
    │
    ▼
State Machine (Ollama llama3.1:8b)
  → Extract: hardFilters, negativeFilters, softPreferences
  → Apply Intent Overrides
    │
    ▼
Retriever (RRF)
  ├─ BM25 (rank-bm25)
  └─ Dense (all-MiniLM-L6-v2)
    │
    ▼
Entropy Check
  ├─ Pool > 100 & H > 1.5 → Clarification Question
  └─ Pool ≤ 30 or Turn ≥ 3 → Cross-Encoder Reranker (ms-marco-MiniLM-L-6-v2)
                                      │
                                      ▼
                              Top-10 Recommendations
```

---

## Project Structure

```
backend/
├── app/
│   ├── api/routes.py          # FastAPI endpoints
│   ├── core/
│   │   ├── state_machine.py   # Slot tracking & LLM override logic
│   │   ├── router.py          # Buying vs Browsing intent routing
│   │   ├── retriever.py       # In-memory BM25 + Dense RRF
│   │   ├── entropy.py         # Variance calculation & cutoff logic
│   │   └── reranker.py        # Cross-Encoder Top-30 reranking
│   ├── db/prisma.py           # Prisma client lifecycle
│   └── main.py                # FastAPI entrypoint
├── schema.prisma              # Prisma schema definition
├── requirements.txt
└── run.py
frontend/
├── src/
│   ├── components/
│   │   ├── ChatPlayground.jsx # Conversational UI
│   │   ├── StateInspector.jsx # Real-time slot debugger
│   │   └── ProductGrid.jsx    # Ranked product cards
│   ├── App.jsx                # 3-panel layout
│   └── index.jsx
├── index.html
├── vite.config.js
└── package.json
```