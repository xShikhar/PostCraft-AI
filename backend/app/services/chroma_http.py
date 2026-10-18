"""Bounded adapter for the Chroma 1.5 HTTP client pinned by uv.lock."""
import httpx
from chromadb.api.fastapi import FastAPI

class BoundedFastAPI(FastAPI):
    def __init__(self, system):
        super().__init__(system)
        # The upstream pinned SDK otherwise disables all HTTP timeouts.
        self._session.timeout = httpx.Timeout(10.0)

def bounded_http_client(host: str, port: int):
    import chromadb
    from chromadb.api import fastapi
    from chromadb.config import Settings
    # Chroma's shared-client factory whitelists the canonical implementation path.
    # Install the bounded subclass at that path before any initialization request.
    # This shim is covered against the exact version pinned by uv.lock.
    fastapi.FastAPI = BoundedFastAPI
    return chromadb.HttpClient(host=host, port=port, settings=Settings(anonymized_telemetry=False))
