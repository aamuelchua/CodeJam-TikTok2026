#!/usr/bin/env bash
# ============================================================
#  run_eval.sh — Run the official evaluator.local_evaluator
#
#  Uses `uv` to sync the backend virtualenv, then executes
#  the evaluator module from the project root so that both
#  `evaluator.*` and `starter.*` are importable and the
#  default relative paths (data/catalog.jsonl, etc.) resolve
#  correctly against the working directory.
#
#  Usage:
#    chmod +x run_eval.sh
#    ./run_eval.sh
#    ./run_eval.sh --catalog data/catalog.jsonl --dataset data/public_set.jsonl
# ============================================================

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT/backend"

# ── Colours ────────────────────────────────────────────────
GREEN='\033[0;32m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "${CYAN}[run_eval]${NC} $*"; }
ok()  { echo -e "${GREEN}[run_eval]${NC} $*"; }
err() { echo -e "${RED}[run_eval]${NC} $*" >&2; }

# ── 1. Pre-flight: check uv is available ───────────────────
if ! command -v uv &>/dev/null; then
  err "uv is not installed. Install it: https://docs.astral.sh/uv/getting-started/installation/"
  exit 1
fi

# ── 2. Sync backend virtualenv & deps via uv ───────────────
log "Syncing backend dependencies via uv…"
cd "$BACKEND_DIR"

if [ ! -d ".venv" ]; then
  log "Creating backend virtualenv…"
  uv venv --python 3.12
fi

uv pip install -r requirements.txt --quiet

# ── 3. Run evaluator from project root ──────────────────────
#
#  CRITICAL: We must run from the project ROOT so that:
#    - `python -m evaluator.local_evaluator` finds the evaluator/ package
#    - `python -m starter.agent` finds the starter/ package
#    - Default paths like `data/catalog.jsonl` resolve to ROOT/data/
#
#  We use the backend's venv Python directly (no cd, no --directory)
#  to avoid ModuleNotFoundError issues.
# ────────────────────────────────────────────────────────────

cd "$ROOT"

log "Running evaluator.local_evaluator from project root…"
"$BACKEND_DIR/.venv/bin/python" -m evaluator.local_evaluator "$@"

ok "Evaluation complete."
