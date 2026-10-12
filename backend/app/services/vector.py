import os
import logging
from app.core.config import get_settings

logger = logging.getLogger(__name__)

# Lazy reference to chromadb — populated on first client access or patched by tests
chromadb = None


class VectorService:
    """
    Wrapper around ChromaDB for storing and querying user style profiles.

    Uses CHROMA_PERSIST_DIR env var (default ./chroma_data) so the path is
    configurable in production. On Render, mount a persistent disk at that
    path or back the data with a separate service — the default local
    path is for development.
    """

    def __init__(self):
        self._client = None
        self._collection = None

    @property
    def _persist_path(self) -> str:
        return os.getenv("CHROMA_PERSIST_DIR", "./chroma_data")

    @property
    def client(self):
        global chromadb
        if self._client is None:
            if chromadb is None:
                import chromadb
            chroma_host = os.getenv("CHROMA_HOST")
            chroma_port = os.getenv("CHROMA_PORT", "8000")
            # Only attempt remote HttpClient if an explicit non-local host is specified (e.g. dedicated container)
            if chroma_host and chroma_host not in ("localhost", "127.0.0.1", ""):
                try:
                    logger.info(f"Connecting to ChromaDB HttpClient at {chroma_host}:{chroma_port}...")
                    self._client = chromadb.HttpClient(host=chroma_host, port=int(chroma_port))
                except Exception as e:
                    logger.warning(f"Failed to connect to ChromaDB at {chroma_host}:{chroma_port}: {e}. Falling back to PersistentClient.")
                    self._client = chromadb.PersistentClient(path=self._persist_path)
            else:
                self._client = chromadb.PersistentClient(path=self._persist_path)
        return self._client

    @property
    def collection(self):
        if self._collection is None:
            self._collection = self.client.get_or_create_collection(name="style_profiles")
        return self._collection

    def save_style_profile(
        self,
        profile_id: str,
        user_id: str,
        platform: str,
        style_text: str,
        created_at: str | None = None,
    ):
        try:
            if not created_at:
                from datetime import datetime, timezone
                created_at = datetime.now(timezone.utc).isoformat()
            self.collection.add(
                documents=[style_text],
                metadatas=[{"user_id": str(user_id), "platform": platform, "created_at": str(created_at)}],
                ids=[str(profile_id)],
            )
            logger.info(f"Saved StyleProfile {profile_id} to ChromaDB.")
        except Exception as e:
            logger.error(f"Failed to save profile to ChromaDB: {e}")

    def get_similar_profile(self, user_id: str, platform: str, query_text: str, n_results: int = 1):
        try:
            results = self.collection.query(
                query_texts=[query_text],
                n_results=n_results,
                where={"$and": [{"user_id": str(user_id)}, {"platform": platform}]},
            )

            documents = results.get("documents") if results else None
            if documents and documents[0]:
                return documents[0][0]
            return None
        except Exception as e:
            logger.error(f"Failed to query ChromaDB: {e}")
            return None

    def get_recent_profiles(self, user_id: str, platform: str, limit: int = 5) -> list[dict]:
        """
        Returns the last N style profile documents for a user+platform,
        ordered by the embedded `created_at` metadata (newest first).

        NOTE: We sort on `created_at` (ISO timestamp stored in metadata),
        NOT on the UUID. UUID v4 is random, so lexicographic UUID sort does
        not reflect insertion order. This was a real bug before the fix.
        """
        try:
            results = self.collection.get(
                where={"$and": [{"user_id": str(user_id)}, {"platform": platform}]},
                include=["documents", "metadatas"],
            )
            if not results or not results.get("ids"):
                return []

            entries = []
            for i, doc_id in enumerate(results["ids"]):
                meta = (results.get("metadatas") or [{}] * len(results["ids"]))[i] or {}
                entries.append({
                    "id": doc_id,
                    "text": results["documents"][i] if i < len(results["documents"]) else "",
                    "created_at": meta.get("created_at", ""),
                })
            # Sort by created_at descending (ISO timestamps sort lexicographically).
            entries.sort(key=lambda e: e["created_at"], reverse=True)
            return entries[:limit]
        except Exception as e:
            logger.error(f"Failed to get recent profiles from ChromaDB: {e}")
            return []

    def delete_oldest_profiles(self, user_id: str, platform: str, keep: int = 10) -> int:
        """
        Deletes all but the newest `keep` style profile entries for user+platform.
        Returns the number of entries deleted.
        """
        try:
            recent = self.get_recent_profiles(user_id, platform, limit=keep)
            keep_ids = {e["id"] for e in recent}

            results = self.collection.get(
                where={"$and": [{"user_id": str(user_id)}, {"platform": platform}]},
            )
            if not results or not results.get("ids"):
                return 0

            to_delete = [id_ for id_ in results["ids"] if id_ not in keep_ids]
            if to_delete:
                self.collection.delete(ids=to_delete)
                logger.info(f"Deleted {len(to_delete)} old style profiles from ChromaDB.")
            return len(to_delete)
        except Exception as e:
            logger.error(f"Failed to delete old profiles from ChromaDB: {e}")
            return 0

    def delete_all_for_user(self, user_id: str) -> int:
        """
        Deletes EVERY style profile entry for a user across all platforms.
        Called when the user deletes their account.
        Returns the number of entries deleted.
        """
        try:
            results = self.collection.get(
                where={"user_id": str(user_id)},
            )
            ids = results.get("ids", []) if results else []
            if not ids:
                return 0
            self.collection.delete(ids=ids)
            logger.info(f"Deleted {len(ids)} style profiles for user {user_id} from ChromaDB.")
            return len(ids)
        except Exception as e:
            logger.error(f"Failed to delete user {user_id}'s profiles from ChromaDB: {e}")
            return 0


# Module-level singleton.
vector_service = VectorService()
