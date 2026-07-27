import chromadb
from chromadb.config import Settings
import logging
from app.config import get_settings

logger = logging.getLogger(__name__)

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

vector_service = VectorService()
