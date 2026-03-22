import json
import logging
import uuid
import numpy as np
import msgpack
from redis.asyncio import Redis
from .gemini_service import GeminiService

logger = logging.getLogger(__name__)

CACHE_PREFIX = "qa:"
EMBEDDING_PREFIX = "emb:"


def cosine_similarity(a: list[float], b: list[float]) -> float:
    va, vb = np.array(a), np.array(b)
    norm_a, norm_b = np.linalg.norm(va), np.linalg.norm(vb)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(va, vb) / (norm_a * norm_b))


class CacheService:
    def __init__(self, redis: Redis, gemini: GeminiService):
        self.redis = redis
        self.gemini = gemini

    async def get_cached_answer(self, question: str, threshold: float = 0.92) -> dict | None:
        """Search semantic cache. Returns {question, answer} or None."""
        try:
            # Step 1: exact match check
            exact_key = f"exact:{question.lower().strip()}"
            exact = await self.redis.get(exact_key)
            if exact:
                data = json.loads(exact)
                await self.redis.incr(f"hits:{data.get('cache_id', 'unknown')}")
                return data

            # Step 2: embed the query
            query_emb = await self.gemini.embed_text(question)

            # Step 3: scan cache keys and compare embeddings
            keys = await self.redis.keys(f"{CACHE_PREFIX}*")
            best_score = 0.0
            best_data = None

            # Limit scan to avoid performance issues
            for key in keys[:500]:
                try:
                    raw = await self.redis.hget(key, "embedding")
                    if not raw:
                        continue
                    cached_emb = msgpack.unpackb(raw)
                    score = cosine_similarity(query_emb, cached_emb)
                    if score > best_score:
                        best_score = score
                        if score >= threshold:
                            answer_raw = await self.redis.hget(key, "answer")
                            if answer_raw:
                                best_data = {
                                    "question": (await self.redis.hget(key, "question") or b"").decode(),
                                    "answer": answer_raw.decode(),
                                    "cache_id": key.decode() if isinstance(key, bytes) else key,
                                }
                except Exception:
                    continue

            if best_data and best_score >= threshold:
                logger.info(f"Semantic cache hit: similarity={best_score:.3f}")
                return best_data

            return None
        except Exception as e:
            logger.error(f"Cache lookup error: {e}")
            return None

    async def cache_answer(self, question: str, answer: str, metadata: dict | None = None) -> None:
        """Store a Q&A pair in the semantic cache."""
        try:
            emb = await self.gemini.embed_text(question)
            cache_id = str(uuid.uuid4())
            key = f"{CACHE_PREFIX}{cache_id}"

            await self.redis.hset(key, mapping={
                "question": question,
                "answer": answer,
                "embedding": msgpack.packb(emb),
                "hit_count": 0,
                "metadata": json.dumps(metadata or {}),
            })
            await self.redis.expire(key, 60 * 60 * 24 * 30)  # 30 day TTL

            # Also store exact match index
            exact_key = f"exact:{question.lower().strip()}"
            await self.redis.setex(
                exact_key,
                60 * 60 * 24 * 30,
                json.dumps({"question": question, "answer": answer, "cache_id": key}),
            )
        except Exception as e:
            logger.error(f"Cache store error: {e}")

    async def warm_cache(self, qa_pairs: list[dict]) -> int:
        """Bulk-load Q&A pairs into semantic cache."""
        count = 0
        for pair in qa_pairs:
            try:
                await self.cache_answer(
                    pair["question"],
                    pair["answer"],
                    {"source": "pre_generated", "textbook_id": pair.get("textbook_id")},
                )
                count += 1
            except Exception:
                continue
        return count

    async def get_cache_stats(self) -> dict:
        try:
            keys = await self.redis.keys(f"{CACHE_PREFIX}*")
            return {"total_cached": len(keys)}
        except Exception:
            return {"total_cached": 0}
