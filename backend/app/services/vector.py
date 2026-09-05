import chromadb
from chromadb.config import Settings
import logging
from app.core.config import get_settings

logger = logging.getLogger(__name__)


def _get_client():
    settings = get_settings()
    return chromadb.PersistentClient(path="./chroma_db")

class VectorService:
    def __init__(self):
        self._client = None
        self._collection = None

    @property
    def client(self):
        if self._client is None:
            self._client = chromadb.PersistentClient(path="./chroma_db")
        return self._client

    @property
    def collection(self):
        if self._collection is None:
            self._collection = self.client.get_or_create_collection(name="style_profiles")
        return self._collection

    def save_style_profile(self, profile_id: str, user_id: str, platform: str, style_text: str):
        try:
            self.collection.add(
                documents=[style_text],
                metadatas=[{"user_id": str(user_id), "platform": platform}],
                ids=[str(profile_id)]
            )
            logger.info(f"Saved StyleProfile {profile_id} to ChromaDB.")
        except Exception as e:
            logger.error(f"Failed to save profile to ChromaDB: {e}")

    def get_similar_profile(self, user_id: str, platform: str, query_text: str, n_results: int = 1):
        try:
            results = self.collection.query(
                query_texts=[query_text],
                n_results=n_results,
                where={"$and": [{"user_id": str(user_id)}, {"platform": platform}]}
            )

            if results["documents"] and results["documents"][0]:
                return results["documents"][0][0]
            return None
        except Exception as e:
            logger.error(f"Failed to query ChromaDB: {e}")
            return None

    def get_recent_profiles(self, user_id: str, platform: str, limit: int = 5) -> list[dict]:
        """
        Returns the last N style profile documents for a user+platform,
        ordered by ID descending (most recent first).
        Each entry: {'id': str, 'text': str}
        """
        try:
            results = self.collection.get(
                where={"$and": [{"user_id": str(user_id)}, {"platform": platform}]},
                limit=100,  # ChromaDB doesn't support ordering, fetch max and sort in Python
            )
            if not results["documents"]:
                return []

            # Sort by ID descending (newer UUIDs have later timestamp components)
            entries = [
                {"id": results["ids"][i], "text": results["documents"][i]}
                for i in range(len(results["ids"]))
            ]
            # Sort descending by ID — works because UUID v4 sorts lexicographically with time components
            entries.sort(key=lambda x: x["id"], reverse=True)
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
                where={"$and": [{"user_id": str(user_id)}, {"platform": platform}]}
            )
            if not results["ids"]:
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
                where={"user_id": str(user_id)}
            )
            if not results["ids"]:
                return 0
            self.collection.delete(ids=results["ids"])
            logger.info(f"Deleted {len(results['ids'])} style profiles for user {user_id} from ChromaDB.")
            return len(results["ids"])
        except Exception as e:
            logger.error(f"Failed to delete user {user_id}'s profiles from ChromaDB: {e}")
            return 0

vector_service = VectorService()
