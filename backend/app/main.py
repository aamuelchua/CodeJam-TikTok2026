"""
FastAPI application entry-point.
"""
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
