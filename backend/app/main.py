import os
import sys

# Ensure project root is in sys.path so starter.agent is importable
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.db import prisma as prisma_db



@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- Startup ---
    await prisma_db.connect()
    yield
    # --- Shutdown ---
    await prisma_db.disconnect()


app = FastAPI(
    title="Shopping Copilot API",
    description="Entropy-driven conversational commerce backend.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/health")
async def health():
    return {"status": "ok"}
