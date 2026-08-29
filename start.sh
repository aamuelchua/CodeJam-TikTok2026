#!/usr/bin/env bash
# ============================================================
#  Shopping Copilot — Root Startup Script
#  Starts the FastAPI backend and Vite frontend in parallel.
#
#  Usage:
#    chmod +x start.sh
#    ./start.sh
# ============================================================

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT/backend"
FRONTEND_DIR="$ROOT/frontend"

# ── Colours ────────────────────────────────────────────────
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Colour

log()  { echo -e "${CYAN}[start.sh]${NC} $*"; }
ok()   { echo -e "${GREEN}[start.sh]${NC} $*"; }
warn() { echo -e "${YELLOW}[start.sh]${NC} $*"; }
err()  { echo -e "${RED}[start.sh]${NC} $*" >&2; }

# ── Trap: kill child processes on Ctrl-C ───────────────────
BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
  warn "Shutting down…"
  [ -n "$BACKEND_PID" ]  && kill "$BACKEND_PID"  2>/dev/null || true
  [ -n "$FRONTEND_PID" ] && kill "$FRONTEND_PID" 2>/dev/null || true
  [ -n "$BACKEND_PID" ]  && wait "$BACKEND_PID"  2>/dev/null || true
  [ -n "$FRONTEND_PID" ] && wait "$FRONTEND_PID" 2>/dev/null || true
  ok "Done."
}
trap cleanup INT TERM

# ── 1. Check required tools ────────────────────────────────
for cmd in python3 node npm uv; do
  if ! command -v "$cmd" &>/dev/null; then
    err "Required tool not found: $cmd"
    exit 1
  fi
done

# ── 2. Backend: virtual-env & deps ─────────────────────────
log "Setting up backend…"
cd "$BACKEND_DIR"

if [ ! -d ".venv" ]; then
  log "Creating Python virtual environment (Python 3.12) using uv…"
  uv venv --python 3.12
else
  if ! "$BACKEND_DIR/.venv/bin/python" --version 2>&1 | grep -q "3.12"; then
    log "Existing virtual environment is not Python 3.12. Recreating with Python 3.12…"
    rm -rf .venv
    uv venv --python 3.12
  fi
fi

# Activate venv
# shellcheck source=/dev/null
source "$BACKEND_DIR/.venv/bin/activate"

log "Installing Python dependencies with uv…"
uv pip install -r requirements.txt

# ── 3. Prisma: generate client + push schema ───────────────
log "Running prisma generate…"
prisma generate --schema="$BACKEND_DIR/schema.prisma"

log "Running prisma db push…"
prisma db push --schema="$BACKEND_DIR/schema.prisma" --accept-data-loss

# ── 4. Check .env exists ────────────────────────────────────
if [ ! -f "$BACKEND_DIR/.env" ]; then
  warn ".env not found in backend/. Copying from .env.example…"
  cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
  warn "Please edit backend/.env and set your API_KEY before restarting."
fi

# ── 5. Frontend: npm install ────────────────────────────────
log "Setting up frontend…"
cd "$FRONTEND_DIR"
if [ ! -d "node_modules" ]; then
  log "Installing Node dependencies…"
  npm install --silent
fi

# ── 6. Launch backend ───────────────────────────────────────
log "Starting FastAPI backend on http://localhost:8000 …"
cd "$BACKEND_DIR"
python run.py &
BACKEND_PID=$!
ok "Backend PID: $BACKEND_PID"

# Give uvicorn a moment to bind
sleep 2

# ── 7. Launch frontend ──────────────────────────────────────
log "Starting Vite frontend on http://localhost:3000 …"
cd "$FRONTEND_DIR"
npm run dev &
FRONTEND_PID=$!
ok "Frontend PID: $FRONTEND_PID"

# ── 8. Summary ──────────────────────────────────────────────
echo ""
ok "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
ok " 🛒  Shopping Copilot is running!"
ok ""
ok "   Frontend  →  http://localhost:3000"
ok "   Backend   →  http://localhost:8000"
ok "   API docs  →  http://localhost:8000/docs"
ok ""
ok "   Press Ctrl-C to stop both services."
ok "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Wait for both processes
wait "$BACKEND_PID" "$FRONTEND_PID"
