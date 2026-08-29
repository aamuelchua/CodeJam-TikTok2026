#!/bin/bash
set -e

echo "=== Running Local Evaluator ==="

if [ -d "backend/.venv" ]; then
    source backend/.venv/bin/activate
elif [ -d ".venv" ]; then
    source .venv/bin/activate
fi

python3 -m evaluator.local_evaluator "$@"
