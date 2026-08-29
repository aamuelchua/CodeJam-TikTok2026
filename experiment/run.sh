#!/bin/bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$DIR/.." && pwd)"

echo "=== Running Local Evaluator (Experiment: with FAISS) ==="

if [ -d "$REPO_ROOT/backend/.venv" ]; then
    source "$REPO_ROOT/backend/.venv/bin/activate"
elif [ -d "$REPO_ROOT/.venv" ]; then
    source "$REPO_ROOT/.venv/bin/activate"
fi

export PYTHONPATH="$DIR:$REPO_ROOT"
export KMP_DUPLICATE_LIB_OK=TRUE
export OMP_NUM_THREADS=1

python3 -m evaluator.local_evaluator \
    --catalog "$DIR/data/catalog.jsonl" \
    --dataset "$DIR/data/public_set.jsonl" \
    --output "$DIR/results.json" \
    "$@"
