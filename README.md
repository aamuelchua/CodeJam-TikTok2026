# 🛒 Shopping Copilot — High-Performance Conversational Commerce

An active **State-Machine RAG Agent** for e-commerce product discovery, conversational slot tracking, and multi-turn recommendation built for the **CodeJam / TechJam 2026 Hackathon**.

Our engine combines **deterministic intent routing**, a **token-efficient conversational state machine**, a **universal probing strategy**, and a **custom-weighted in-memory SQLite FTS5 retrieval engine** to deliver sub-millisecond search latencies and high conversational precision.

---

## 1. Project Overview & Architecture

Modern e-commerce search requires balancing conversational understanding with strict latency and token budgets. Heavy multi-agent LLM pipelines or dense vector stores often suffer from high token costs, high inference latency, and cold-start index bloat.

Our solution implements a **3-stage hybrid architecture** optimized for high retrieval accuracy, minimal turns to conversion (MTTC), and conservative token usage.

```
                      ┌─────────────────────────────────────────┐
                      │            User Chat Turn               │
                      └────────────────────┬────────────────────┘
                                           │
                                           ▼
             ┌───────────────────────────────────────────────────────────┐
             │ Stage 1: Intent Routing & Hybrid State Machine           │
             │                                                           │
             │  • Fast-path Regex Slot Extractor (Category & Attributes) │
             │  • Dynamic Intent Override & Slot Erasure Handling       │
             │  • LLM Selective Invocation (Fallback for complex turns)  │
             └─────────────────────────────┬─────────────────────────────┘
                                           │
                                           ▼
             ┌───────────────────────────────────────────────────────────┐
             │ Stage 2: Universal Probing Strategy                      │
             │                                                           │
             │  • ask_attribute = "other" for rapid attribute gathering  │
             │  • Reduces MTTC to ~2.89 turns across multi-turn sessions │
             └─────────────────────────────┬─────────────────────────────┘
                                           │
                                           ▼
             ┌───────────────────────────────────────────────────────────┐
             │ Stage 3: Weighted SQLite FTS5 In-Memory Retrieval        │
             │                                                           │
             │  • Multi-Field BM25 Ranking Engine                        │
             │  • Column Weights: Title (12.0), Category (12.0),         │
             │    Features (9.0), Details (2.0), Store (1.0), Desc (1.0) │
             └─────────────────────────────┬─────────────────────────────┘
                                           │
                                           ▼
                      ┌─────────────────────────────────────────┐
                      │    Top-10 Recommended Products & State  │
                      └─────────────────────────────────────────┘
```

### Stage 1: Intent Routing & Hybrid State Machine
- **Dual-Track Intent Detection**: Incoming queries are categorized into `BUYING` (hard constraints present) or `BROWSING` (exploratory preferences).
- **Fast-Path Regex Slot Extraction**: Regex extractors parse product categories, explicit constraints (`key requirement is:`, `what matters is:`), and price boundaries without LLM overhead.
- **Intent Override & Slot Erasure**: When a user changes their mind (e.g., *"Actually, ignore my earlier preference. What I need is..."*), the state machine erases invalidated prior constraints and isolates the active requirement.
- **Token Conservation**: By relying on deterministic regex for standard conversational turns and reserving LLM inference (`llama3.1:8b` via LangChain) for complex ambiguity and intent overrides, we keep total evaluation token consumption to **~42k tokens across 200 sessions** (averaging only ~210 tokens per full session).

### Stage 2: Universal Probing Strategy
- In multi-turn dialogues, narrow attribute questions (e.g., asking only for *"color"*) risk stalling if the customer has other priority constraints.
- We implement a **Universal Probing** strategy by setting `ask_attribute = "other"` during exploratory turns (Turns 1–4).
- This prompts the simulated customer to disclose their highest-priority remaining hard and soft constraints, driving our **Mean Turns to Conversion (MTTC) down to 2.89 turns**.

### Stage 3: Weighted In-Memory SQLite FTS5 Retrieval
- Instead of heavyweight vector databases with embedding latencies, we index the full product catalog into an in-memory **SQLite FTS5 virtual table** with `unicode61` tokenization.
- We utilize multi-field BM25 ranking with tuned column weights to prioritize high-signal product fields:

| Column Field | FTS5 BM25 Weight | Rationale |
| :--- | :---: | :--- |
| **Title** | `12.0` | Primary product identifier and headline intent match |
| **Category** | `12.0` | Eliminates cross-category false positives |
| **Features** | `9.0` | Captures key attributes (material, fit, waterproof, etc.) |
| **Details** | `2.0` | Technical specifications, dimensions, and metadata |
| **Store** | `1.0` | Brand and storefront matching |
| **Description** | `1.0` | Broad contextual and semantic descriptions |

---

## 2. Setup and Installation

### Prerequisites
- **Python**: `>= 3.12`
- **Node.js**: `>= 18.0`
- **uv**: Fast Python package installer (`curl -LsSf https://astral.sh/uv/install.sh | sh`)

### Step 1: Clone and Place Catalog Dataset
Ensure the catalog and evaluation datasets are placed inside the `data/` directory at the repository root:
```bash
# Ensure catalog and benchmark dataset exist in data/
mkdir -p data
# Place catalog.jsonl and public_set.jsonl in data/
# data/catalog.jsonl
# data/public_set.jsonl
```

---

### Step 2: Running the Application & Evaluation

We provide two self-contained, `uv`-managed root scripts:

#### Option A: Run Official Benchmark Evaluation (`run_eval.sh`)
Executes the headless benchmark against the 200 public test sessions using `uv` and the backend Python environment:
```bash
chmod +x run_eval.sh
./run_eval.sh --catalog data/catalog.jsonl --dataset data/public_set.jsonl
```
> Outputs detailed metrics to stdout and writes full session traces to `results.json`.

#### Option B: Boot Interactive Demo Environment (`start.sh`)
Launches the FastAPI backend (`http://localhost:8000`) and the Vite React frontend (`http://localhost:3000`) concurrently with clean signal handling:
```bash
chmod +x start.sh
./start.sh
```

- **Frontend UI / Copilot Playground**: `http://localhost:3000`
- **Backend API & Swagger Docs**: `http://localhost:8000/docs`
- Press `Ctrl+C` in the terminal to cleanly terminate both processes.

---

## 3. Reproducibility & Benchmark Results

Our system was evaluated using the official `evaluator.local_evaluator` benchmark over **200 public test sessions** spanning 4 dialogue scenarios (`boundary`, `browsing`, `buying`, `intent_override`).

### Overall Benchmark Metrics

| Metric | Target / Baseline | Our Copilot Result |
| :--- | :---: | :---: |
| **Hit Rate@10** | `0.50` | **`0.9400` (94.0%)** |
| **MRR (Mean Reciprocal Rank)** | `0.30` | **`0.6407`** |
| **MTTC (Mean Turns to Conversion)** | `5.00` | **`2.8950` turns** |
| **Efficiency Score** | — | **`0.8105`** |
| **Recommended Technical Score** | — | **`0.8243`** |
| **Total Token Consumption** | — | **`41,829` tokens (~42k)** |

### Scenario Breakdown

| Scenario Type | Sample Count | Hit Rate@10 | MRR | MTTC |
| :--- | :---: | :---: | :---: | :---: |
| **Boundary** | 10 | `1.0000` (100%) | `0.8310` | `3.30` turns |
| **Browsing** | 80 | `0.9625` (96.25%) | `0.6095` | `2.61` turns |
| **Buying** | 80 | `0.9250` (92.50%) | `0.6227` | `2.53` turns |
| **Intent Override** | 30 | `0.9000` (90.00%) | `0.7082` | `4.50` turns |

---

## 4. Limitations & Future Work

While our weighted FTS5 architecture delivers exceptional speed, high MRR, and low token cost, we note the following engineering tradeoffs:

1. **Exact-Token & Lexical Dependency**:
   - SQLite FTS5 relies on BM25 token matching and stem/prefix heuristics. It lacks dense semantic understanding for non-overlapping synonyms (e.g., mapping *"summer apparel"* to *"warm weather outfits"* or *"rainproof"* to *"water repellent"* when exact tokens are absent).
2. **Proposed Future Enhancement — Two-Stage Semantic Hybrid**:
   - **Stage 1 (Retrieval)**: Use FTS5 BM25 to retrieve a top-50 candidate pool in `< 2ms`.
   - **Stage 2 (Reranking)**: Apply a lightweight, quantized Cross-Encoder or MiniLM embedding model solely over the top-50 candidates. This adds deep semantic relevance without inflating latency or token overhead.
3. **Dynamic Entropy-Based Attribute Branching**:
   - Extend the universal probe with Shannon entropy scoring across candidate attributes to dynamically select between `"other"`, category-specific narrowing, or price-range clustering when candidate variance is exceptionally high.

---

## 5. Tech Stack & Team

### Technology Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Language & Runtime** | Python 3.12, Node.js 18+ | Backend and Frontend environments |
| **Package Management** | `uv`, `npm` | Deterministic, fast virtualenv and dependency sync |
| **Backend Framework** | FastAPI, Uvicorn | Async REST API endpoints |
| **Search Engine** | SQLite FTS5 (In-Memory) | Weighted multi-field BM25 candidate retrieval |
| **Database & ORM** | Prisma Client Python, SQLite | Session, state snapshot, and user profile persistence |
| **LLM & Orchestration** | LangChain, LangChain-OpenAI / Ollama | Slot extraction and intent override fallback |
| **Frontend Framework** | React 18, Vite | Interactive UI and real-time state inspection |
| **Styling & Icons** | Tailwind CSS, Lucide React | Glassmorphic design and responsive components |

### Team Members
- **[Team Member 1]** — [Role / GitHub]
- **[Team Member 2]** — [Role / GitHub]
- **[Team Member 3]** — [Role / GitHub]
- **[Team Member 4]** — [Role / GitHub]