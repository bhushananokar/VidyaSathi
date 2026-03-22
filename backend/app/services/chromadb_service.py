import logging
import chromadb
from ..config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

COLLECTION_NAME = "textbook_chunks"


class ChromaDBService:
    def __init__(self):
        # Use CloudClient for ChromaDB Cloud (api.trychroma.com)
        # Falls back to HttpClient for self-hosted instances
        if settings.chroma_api_key and "trychroma.com" in settings.chroma_host:
            self.client = chromadb.CloudClient(
                tenant=settings.chroma_tenant,
                database=settings.chroma_database,
                api_key=settings.chroma_api_key,
            )
        else:
            headers = {}
            if settings.chroma_api_key:
                headers["X-Chroma-Token"] = settings.chroma_api_key
            self.client = chromadb.HttpClient(
                host=settings.chroma_host,
                port=settings.chroma_port,
                ssl=settings.chroma_ssl,
                headers=headers,
                tenant=settings.chroma_tenant,
                database=settings.chroma_database,
            )

        self.collection = self.client.get_or_create_collection(
            name=COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},
        )

    async def add_chunks(self, chunks: list[dict]) -> None:
        """
        Each chunk: {id, content, embedding, metadata}
        metadata: {textbook_id, chapter, topic, subtopic, page_no, content_type, difficulty}
        """
        if not chunks:
            return
        try:
            self.collection.add(
                ids=[c["id"] for c in chunks],
                documents=[c["content"] for c in chunks],
                embeddings=[c["embedding"] for c in chunks],
                metadatas=[c.get("metadata", {}) for c in chunks],
            )
        except Exception as e:
            logger.error(f"ChromaDB add error: {e}")

    async def search(
        self,
        query_embedding: list[float],
        n_results: int = 5,
        filters: dict | None = None,
    ) -> list[dict]:
        """Returns list of {content, metadata, distance}"""
        try:
            where = filters if filters else None
            results = self.collection.query(
                query_embeddings=[query_embedding],
                n_results=min(n_results, self.collection.count() or 1),
                where=where,
                include=["documents", "metadatas", "distances"],
            )
            output = []
            if results and results["documents"]:
                for doc, meta, dist in zip(
                    results["documents"][0],
                    results["metadatas"][0],
                    results["distances"][0],
                ):
                    output.append({"content": doc, "metadata": meta or {}, "distance": dist})
            return output
        except Exception as e:
            logger.error(f"ChromaDB search error: {e}")
            return []

    async def delete_textbook_chunks(self, textbook_id: str) -> None:
        try:
            self.collection.delete(where={"textbook_id": textbook_id})
        except Exception as e:
            logger.error(f"ChromaDB delete error: {e}")

    def get_chunk_count(self) -> int:
        try:
            return self.collection.count()
        except Exception:
            return 0
