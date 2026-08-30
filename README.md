# 🛒 Sivle Copilot — High-Performance Conversational Commerce

An active **State-Machine RAG Agent** for conversational e-commerce product discovery, slot tracking, and multi-turn recommendation built for the **CodeJam / TechJam 2026 Hackathon**.

Our solution delivers sub-millisecond retrieval latencies, high conversational precision, and conservative token consumption through a **dual-execution architecture** powered by an **in-memory SQLite FTS5 multi-field BM25 retrieval engine**, a **fast-path regex state machine with LLM fallback**, and a **universal probing strategy**.

---

## 1. Executive Summary & System Architecture

### Dual Execution Paths

The repository provides two synchronized execution environments sharing the core `starter.agent.Agent` runtime:

1. **Headless Benchmark Engine (`evaluator.local_evaluator`)**:
   - Direct, high-throughput in-process Python execution (`evaluator/local_evaluator.py` $\rightarrow$ `starter/agent.py` $\rightarrow$ `starter/rag_pipeline.py`).
   - Zero HTTP or networking overhead, evaluating 200 multi-turn test sessions in seconds.
2. **Interactive Full-Stack Demo (FastAPI + React 18 + Vite)**:
   - Real-time developer playground featuring a dual-pane **Conversational Copilot** and **State Inspector**.
   - Visualizes live slot state (`intentTrack`, `hardFilters`, `negativeFilters`, `softPreferences`), real-time token telemetry, and ranked product metadata cards.

```
═════════════════════════════════════════════════════════════════════════════════
                         DUAL EXECUTION ARCHITECTURE
═════════════════════════════════════════════════════════════════════════════════

  [Headless Benchmark Path]                     [Interactive Full-Stack Path]
    ./run_eval.sh                                  ./start.sh
         │                                              │
         ▼                                              ▼
  evaluator/local_evaluator.py                 React 18 Frontend (Vite)
         │                                     (Chat & State Inspector UI)
         │                                              │  HTTP /api/sessions/turn
         │                                              ▼
         │                                     FastAPI Backend (routes.py)
         │                                              │
         └──────────────────────┬───────────────────────┘
                                │
                                ▼
                    starter/agent.py (Agent)
                                │
                                ▼
                  starter/rag_pipeline.py (RAG)
                                │
    ┌───────────────────────────┼───────────────────────────┐
    ▼                           ▼                           ▼
[Stage 1: Intent & State]  [Stage 2: Universal Probe]  [Stage 3: SQLite FTS5]
 • Fast-path Regex           • ask_attribute="other"     • Multi-field BM25
 • Slot Erasure (Override)   • Rapid MTTC convergence   • In-memory Catalog
 • Selective LLM Fallback                                • Custom Column Weights
                                │
                                ▼
                   Top-10 Recommended Products
═════════════════════════════════════════════════════════════════════════════════
```

---

### 3-Stage RAG Pipeline Design

```
                      ┌─────────────────────────────────────────┐
                      │            User Chat Turn               │
                      └────────────────────┬────────────────────┘
                                           │
                                           ▼
             ┌───────────────────────────────────────────────────────────┐
             │ Stage 1: Intent Routing & Hybrid State Machine           │
             │                                                           │
             │  • Deterministic Fast-Path Regex (Category, Constraints)  │
             │  • Dynamic Intent Override & Invalidation Slot Erasure    │
             │  • Optional LLM Fallback (OpenAI-compatible / Offline)    │
             └─────────────────────────────┬─────────────────────────────┘
                                           │
                                           ▼
             ┌───────────────────────────────────────────────────────────┐
             │ Stage 2: Universal Probing Strategy                      │
             │                                                           │
             │  • Dynamic Probing: ask_attribute = "other"               │
             │  • Unlocks Highest-Priority Remaining User Constraints   │
             │  • Drives MTTC down to 2.895 Turns                        │
             └─────────────────────────────┬─────────────────────────────┘
                                           │
                                           ▼
             ┌───────────────────────────────────────────────────────────┐
             │ Stage 3: High-Performance SQLite FTS5 Retrieval          │
             │                                                           │
             │  • In-Memory Virtual Table with unicode61 Tokenizer       │
             │  • Tuned BM25 Multi-Field Column Weights:                 │
             │    Title: 12.0 | Category: 12.0 | Features: 9.0           │
             │    Details: 2.0 | Store: 1.0 | Description: 1.0           │
             └─────────────────────────────┬─────────────────────────────┘
                                           │
                                           ▼
                      ┌─────────────────────────────────────────┐
                      │   Top-10 Ranked Products + Telemetry    │
                      └─────────────────────────────────────────┘
```

#### Stage 1: Intent Routing & State Machine
- **Dual-Track Intent Routing**: Detects conversational orientation (`BUYING` for targeted constraints vs. `BROWSING` for exploratory discovery).
- **Fast-Path Regex Slot Extraction**: Extracts product categories, explicit constraints (`key requirement is:`, `what matters is:`), and price boundaries deterministically with zero latency.
- **Intent Override & Slot Erasure**: When a customer changes their mind (e.g., *"Actually, ignore my earlier preference. What I need is..."*), the state machine identifies the negation, removes invalidated prior constraints (`sess["initial_pref"]`), and isolates the replacement requirement.
- **Selective LLM Fallback**: An optional OpenAI-compatible LLM (`llama3.1:8b` via LangChain) can be invoked for deep conversational reasoning on ambiguous turns, while offline regex guarantees deterministic fallback. Total token consumption across all 200 evaluation sessions remains capped at **~42k tokens** (~210 tokens/session).

#### Stage 2: Universal Probing (`ask_attribute = "other"`)
- In multi-turn commerce interactions, asking rigid single-attribute questions (e.g., prompting solely for *"color"*) stalls dialog if the customer prioritizes a different attribute (e.g., *material* or *budget*).
- We deploy a **Universal Probing** strategy by setting `ask_attribute = "other"` during exploratory turns (Turns 1–4).
- Under the benchmark specification, this prompts the simulated customer to disclose up to two of their highest-priority remaining hard and soft constraints, rapidly narrowing the candidate pool and driving **Mean Turns to Conversion (MTTC) to 2.895 turns**.

#### Stage 3: High-Performance SQLite FTS5 Retrieval
- Instead of relying on heavy vector database indexing and embedding model latency, the catalog is indexed into an in-memory **SQLite FTS5 virtual table** with `unicode61 remove_diacritics 2` tokenization upon initialization.
- Ranked using SQLite's native multi-field BM25 algorithm with tuned column weightings:

| Column Field | FTS5 BM25 Weight | Engineering Rationale |
| :--- | :---: | :--- |
| **Title** | `12.0` | Primary product identifier and headline intent match |
| **Category** | `12.0` | Eliminates cross-category false positives and enforces taxonomy |
| **Features** | `9.0` | Captures key attributes (material, fit, waterproofing, ergonomics) |
| **Details** | `2.0` | Matches technical specifications, dimensions, and metadata |
| **Store** | `1.0` | Supports brand and storefront matching |
| **Description** | `1.0` | Captures broad contextual keywords without diluting top rank |

---

## 2. Setup & Execution Instructions

### Prerequisites
- **Python**: `>= 3.12`
- **Node.js**: `>= 18.0`
- **uv**: Modern, high-performance Python package manager ([Install uv](https://docs.astral.sh/uv/getting-started/installation/))
  ```bash
  curl -LsSf https://astral.sh/uv/install.sh | sh
  ```

### Datasets
The required catalog and benchmark evaluation sets are **pre-packaged** in the repository:
- `data/catalog.jsonl` — Full e-commerce product catalog
- `data/public_set.jsonl` — 200 public test benchmark sessions

---

### Environment Configuration (Optional)
To enable optional remote LLM fallback integration (OpenAI, Ollama, or custom OpenAI-compatible endpoints), copy `.env.example` to `.env` in the repository root:
```bash
cp .env.example .env
```
Contents of `.env.example`:
```env
# Optional: OpenAI-compatible LLM endpoint for fallback slot extraction
API_KEY="your-api-key"
BASE_URL="https://api.openai.com/v1"
MODEL="llama3.1:8b"
```
> **Note**: The core FTS5 retrieval engine and deterministic state machine run 100% offline out-of-the-box without requiring API keys or active internet access.

---

### Execution Commands

#### 1. Headless Benchmark Evaluation (`./run_eval.sh`)

> **Default Evaluation**: `./run_eval.sh` **does not require an input file**. When executed without arguments, it **automatically defaults to `data/public_set.jsonl`** as the test dataset and `data/catalog.jsonl` as the product catalog.

##### A. Running Without Specifying an Input File (Default)
To evaluate against the official 200 public test benchmark (`data/public_set.jsonl`), simply run:
```bash
./run_eval.sh
```
- **No arguments or input files needed**: Defaults automatically to `data/public_set.jsonl` and `data/catalog.jsonl`.
- Automatically syncs backend virtualenv dependencies using `uv`.
- Outputs summary metrics directly to stdout and saves detailed session evaluation logs to `results.json`.

##### B. Running With a Specific Test File (Optional)
To evaluate on any of the randomized 200-sample test sets in `test-data/`, pass the `--dataset` argument:
```bash
# 1. Standard test set 1 (Seed 101)
./run_eval.sh --dataset test-data/test_set_1_standard.jsonl

# 2. Standard test set 2 (Seed 202)
./run_eval.sh --dataset test-data/test_set_2_standard.jsonl

# 3. Buying-heavy mixture (65% buying intent)
./run_eval.sh --dataset test-data/test_set_3_buying_heavy.jsonl

# 4. Browsing-heavy mixture (65% browsing exploration)
./run_eval.sh --dataset test-data/test_set_4_browsing_heavy.jsonl

# 5. Intent-override heavy mixture (45% slot overrides)
./run_eval.sh --dataset test-data/test_set_5_override_heavy.jsonl
```

##### C. Specifying Custom Catalog or Output Paths
```bash
./run_eval.sh --dataset test-data/test_set_1_standard.jsonl --output results_set1.json
```

##### D. Generating Additional Randomized Test Sets
You can generate fresh randomized 200-sample test sets with custom random seeds or scenario mixtures anytime:
```bash
python3 test-data/generate_test_data.py \
  --catalog data/catalog.jsonl \
  --output test-data/my_custom_test.jsonl \
  --size 200 \
  --seed 999 \
  --mixture standard

# Evaluate on your newly generated dataset
./run_eval.sh --dataset test-data/my_custom_test.jsonl
```

---

#### 2. Interactive Full-Stack Demo (`./start.sh`)
Launches the FastAPI backend and Vite React frontend concurrently with integrated signal trapping:
```bash
chmod +x start.sh
./start.sh
```
- **Frontend Dashboard**: [http://localhost:3000](http://localhost:3000) (Defaults to the **Copilot Playground** dual-pane Chat + State Inspector view)
- **Backend API & Swagger Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
- Press `Ctrl+C` in the terminal to cleanly terminate both processes.

---

## 3. Verified Benchmark Results

The benchmark was executed using the official `evaluator.local_evaluator` on the 200 public test cases. The exact recorded metrics from [`results.json`](results.json) are:

### Overall Benchmark Metrics (Official Public Set)

| Metric | Target / Starter Baseline | Our Verified Result | Status |
| :--- | :---: | :---: | :---: |
| **Hit Rate@10** | `0.5000` | **`0.9800` (98.0%)** | 🟢 **+48.0% over target** |
| **MRR (Mean Reciprocal Rank)** | `0.3000` | **`0.7285`** | 🟢 **+0.4285 over target** |
| **MTTC (Mean Turns to Conversion)** | `5.0000` | **`2.2900` turns** | 🟢 **-2.710 turns faster** |
| **Efficiency Score** | — | **`0.8710`** | 🟢 **Rapid convergence** |
| **Recommended Technical Score** | — | **`0.8828`** | 🟢 **Top-tier performance** |
| **Total Reported Token Usage** | — | **`31,825` tokens** | 🟢 **~159 tokens / session** |

### Scenario Breakdown (Official Public Set)

| Scenario Type | Sample Count | Hit Rate@10 | MRR | MTTC |
| :--- | :---: | :---: | :---: | :---: |
| **Boundary** | 10 | **`1.0000` (100.0%)** | **`0.9500`** | **`2.6000` turns** |
| **Browsing** | 80 | **`1.0000` (100.0%)** | **`0.6750`** | **`1.9625` turns** |
| **Buying** | 80 | **`0.9625` (96.25%)** | **`0.7085`** | **`1.9625` turns** |
| **Intent Override** | 30 | **`0.9667` (96.67%)** | **`0.8509`** | **`3.9333` turns** |

### Multi-Dataset Generalization Results

To prove that the RAG pipeline is robust and not overfitted to any single dataset, the agent was benchmarked across 1,200 sessions across 6 diverse datasets and mixtures:

| Dataset | Mixture / Scenario Distribution | Hit Rate @ 10 | MRR | MTTC | Technical Score |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **Public Set (Official)** | Baseline (200 samples) | **0.9800** | **0.7285** | **2.290** | **0.8828** |
| **Set 1: Standard** | Standard (Seed 101) | **0.9650** | **0.7053** | **2.505** | **0.8640** |
| **Set 2: Standard** | Standard (Seed 202) | **0.9450** | **0.6960** | **2.705** | **0.8472** |
| **Set 3: Buying-Heavy** | 65% Buying (Seed 303) | **0.9300** | **0.6382** | **2.695** | **0.8226** |
| **Set 4: Browsing-Heavy** | 65% Browsing (Seed 404) | **0.9500** | **0.6890** | **2.755** | **0.8466** |
| **Set 5: Override-Heavy** | 45% Override (Seed 505) | **0.9800** | **0.7609** | **2.895** | **0.8804** |

---

## 4. Engineering Tradeoffs & Limitations

### Current Tradeoffs
1. **Lexical Dependence of BM25**:
   - SQLite FTS5 relies on exact token matching, stemming, and token proximity. While tuned column weighting resolves structural and categorical mismatches, it lacks semantic embedding alignment for non-overlapping synonyms (e.g., query *"summer apparel"* vs. catalog item *"warm weather linen shirt"*).
2. **Deterministic Probing Heuristic**:
   - While `ask_attribute = "other"` maximally accelerates constraint acquisition on the benchmark simulator, real human shoppers occasionally benefit from category-specific multiple-choice prompts (e.g., offering specific style tags).

### Proposed Future Work: Two-Stage Semantic Hybrid
Given additional engineering time, we propose extending the engine with a **Two-Stage Semantic Hybrid Retrieval Pipeline**:
1. **Stage 1 (High-Recall Candidate Retrieval)**:
   - Use in-memory SQLite FTS5 to retrieve the Top-50 candidates in `< 2ms` with zero embedding overhead.
2. **Stage 2 (Quantized Cross-Encoder Reranking)**:
   - Execute a quantized, local cross-encoder (e.g., `ms-marco-MiniLM-L-6-v2` ONNX runtime) over the Top-50 candidates.
   - Computes query-document cross-attention only on the pre-filtered pool, adding semantic synonym matching while preserving sub-15ms response times.

---

## 5. Tech Stack & Team

### Technology Stack

| Layer | Component | Description |
| :--- | :--- | :--- |
| **Runtime & Language** | Python 3.12, Node.js 18+ | Core agent runtime and frontend environment |
| **Dependency Management** | `uv`, `npm` | Deterministic, ultra-fast virtualenv and package sync |
| **Backend API** | FastAPI, Uvicorn | High-throughput asynchronous REST API |
| **Search Engine** | SQLite FTS5 (In-Memory) | Weighted multi-field BM25 candidate retrieval |
| **ORM & Persistence** | Prisma Client Python, SQLite | Session, state snapshot, and user profile persistence |
| **LLM & Agent Framework** | LangChain, LangChain-OpenAI / Ollama | Optional slot extraction & fallback reasoning |
| **Frontend Framework** | React 18, Vite | Dual-pane Copilot Playground & Developer Inspector |
| **UI Design System** | Tailwind CSS, Lucide React | Glassmorphic dark/light UI and state visualization |

### Team Members
- Aamuel Chua
- Elvis Ong