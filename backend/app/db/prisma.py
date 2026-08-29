"""
Prisma client singleton for async lifecycle management.
"""
from prisma import Prisma

_client: Prisma | None = None


def get_client() -> Prisma:
    if _client is None:
        raise RuntimeError("Prisma client is not initialised. Call connect() first.")
    return _client


async def connect() -> Prisma:
    global _client
    _client = Prisma()
    await _client.connect()
    return _client


async def disconnect() -> None:
    global _client
    if _client is not None:
        await _client.disconnect()
        _client = None
