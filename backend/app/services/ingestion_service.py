import asyncio
import logging
import re
import time
import uuid
from pathlib import Path
import fitz  # PyMuPDF
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from .gemini_service import GeminiService
from .chromadb_service import ChromaDBService
from .cache_service import CacheService
from ..database import Textbook, QAPair, ContentPack
from ..config import get_settings
import msgpack
import brotli
import json

logger = logging.getLogger(__name__)
settings = get_settings()

CHUNK_TARGET_TOKENS = 500
OVERLAP_SENTENCES = 2


def estimate_tokens(text: str) -> int:
    return len(text.split()) * 1.3


def split_into_sentences(text: str) -> list[str]:
    sentences = re.split(r"(?<=[.!?])\s+", text.strip())
    return [s.strip() for s in sentences if s.strip()]


def smart_chunk(text: str, metadata: dict) -> list[dict]:
    """Split text into semantically meaningful chunks ~500 tokens each."""
    sentences = split_into_sentences(text)
    chunks = []
    current_chunk: list[str] = []
    current_tokens = 0

    for sent in sentences:
        sent_tokens = estimate_tokens(sent)
        if current_tokens + sent_tokens > CHUNK_TARGET_TOKENS and current_chunk:
            chunks.append({
                "id": str(uuid.uuid4()),
                "content": " ".join(current_chunk),
                "metadata": {**metadata},
            })
            # Overlap: keep last OVERLAP_SENTENCES sentences
            current_chunk = current_chunk[-OVERLAP_SENTENCES:]
            current_tokens = sum(estimate_tokens(s) for s in current_chunk)
        current_chunk.append(sent)
        current_tokens += sent_tokens

    if current_chunk:
        chunks.append({
            "id": str(uuid.uuid4()),
            "content": " ".join(current_chunk),
            "metadata": {**metadata},
        })

    return chunks


def detect_chapter_structure(page_text: str, page_num: int) -> dict | None:
    """Detect if a page starts a new chapter/section."""
    lines = page_text.strip().split("\n")[:5]
    for line in lines:
        line = line.strip()
        # Chapter heading patterns
        if re.match(r"^(Chapter|CHAPTER|Unit|UNIT)\s+\d+", line):
            return {"type": "chapter", "title": line, "page": page_num}
        if re.match(r"^\d+\.\s+[A-Z][A-Za-z\s]{5,50}$", line):
            return {"type": "section", "title": line, "page": page_num}
    return None


class IngestionService:
    def __init__(self, gemini: GeminiService, chromadb: ChromaDBService, cache: CacheService):
        self.gemini = gemini
        self.chromadb = chromadb
        self.cache = cache

    async def process_pdf(
        self,
        file_path: str,
        textbook_id: str,
        textbook_meta: dict,
        db: AsyncSession,
    ) -> dict:
        start_time = time.time()
        chunks_stored = 0
        chapters_found = []

        try:
            doc = fitz.open(file_path)
            current_chapter = 1
            current_chapter_title = f"Chapter 1"
            current_topic = ""
            all_text_chunks: list[dict] = []

            for page_num, page in enumerate(doc, start=1):
                page_text = page.get_text("text")
                if not page_text.strip():
                    continue

                # Detect chapter structure
                structure = detect_chapter_structure(page_text, page_num)
                if structure and structure["type"] == "chapter":
                    current_chapter += 1
                    current_chapter_title = structure["title"]
                    chapters_found.append({"chapter": current_chapter, "title": current_chapter_title, "page": page_num})

                metadata = {
                    "textbook_id": textbook_id,
                    "subject": textbook_meta.get("subject", ""),
                    "grade": str(textbook_meta.get("grade", "")),
                    "board": textbook_meta.get("board", ""),
                    "chapter": current_chapter,
                    "chapter_title": current_chapter_title,
                    "topic": current_topic,
                    "page_no": page_num,
                    "content_type": "text",
                }

                page_chunks = smart_chunk(page_text, metadata)
                all_text_chunks.extend(page_chunks)

            # Embed all chunks in batches of 20
            batch_size = 20
            for i in range(0, len(all_text_chunks), batch_size):
                batch = all_text_chunks[i: i + batch_size]
                texts = [c["content"] for c in batch]
                embeddings = await self.gemini.embed_batch(texts)

                for chunk, emb in zip(batch, embeddings):
                    chunk["embedding"] = emb

                await self.chromadb.add_chunks(batch)
                chunks_stored += len(batch)
                await asyncio.sleep(0.1)  # rate limit

            doc.close()

            # Update textbook status
            await db.execute(
                update(Textbook)
                .where(Textbook.id == textbook_id)
                .values(status="ready", total_chunks=chunks_stored)
            )
            await db.commit()

            elapsed = time.time() - start_time
            return {
                "chunks_count": chunks_stored,
                "chapters_found": len(chapters_found),
                "processing_time": elapsed,
            }

        except Exception as e:
            logger.error(f"PDF processing error: {e}")
            await db.execute(
                update(Textbook).where(Textbook.id == textbook_id).values(status="error")
            )
            await db.commit()
            raise

    async def generate_qa_pairs(
        self,
        textbook_id: str,
        chapter: int,
        db: AsyncSession,
    ) -> list[dict]:
        """Generate Q&A pairs for a chapter and warm the semantic cache."""
        prompt = f"""Generate 15 diverse educational Q&A pairs for Chapter {chapter} of a textbook.

Format each pair exactly as:
Q: [question]
A: [answer]

Mix question types: factual, conceptual, application. Keep answers concise (1-3 sentences).
Include easy (5), medium (7), and hard (3) difficulty questions.
Return only the Q&A pairs, nothing else."""

        text, _ = await self.gemini.generate_flash(prompt)
        pairs = []

        # Parse Q/A pairs
        lines = text.strip().split("\n")
        current_q = current_a = ""
        for line in lines:
            line = line.strip()
            if line.startswith("Q:"):
                current_q = line[2:].strip()
            elif line.startswith("A:") and current_q:
                current_a = line[2:].strip()
                if current_q and current_a:
                    pair = {
                        "id": str(uuid.uuid4()),
                        "textbook_id": textbook_id,
                        "chapter": chapter,
                        "question": current_q,
                        "answer": current_a,
                        "difficulty": "medium",
                        "topic": f"Chapter {chapter}",
                    }
                    pairs.append(pair)

                    # Store in DB
                    db.add(QAPair(**{k: v for k, v in pair.items() if k != "id"}, id=pair["id"]))
                    current_q = current_a = ""

        await db.commit()

        # Warm semantic cache
        await self.cache.warm_cache(pairs)

        return pairs

    async def generate_content_pack(
        self,
        textbook_id: str,
        chapter: int,
        textbook_meta: dict,
        qa_pairs: list[dict],
        db: AsyncSession,
    ) -> str:
        """Bundle content into a compressed pack for offline use."""
        pack_data = {
            "subject": textbook_meta.get("subject"),
            "grade": textbook_meta.get("grade"),
            "board": textbook_meta.get("board"),
            "chapter": chapter,
            "chapter_title": f"Chapter {chapter}",
            "version": "2025.1",
            "qa_pairs": [
                {"q": p["question"], "a": p["answer"], "difficulty": p.get("difficulty", "medium")}
                for p in qa_pairs
            ],
        }

        # Compress with msgpack + brotli
        packed = msgpack.packb(pack_data, use_bin_type=True)
        compressed = brotli.compress(packed)

        # Save to disk
        pack_dir = Path(settings.content_packs_dir)
        pack_dir.mkdir(exist_ok=True)
        pack_id = str(uuid.uuid4())
        file_path = pack_dir / f"{pack_id}.pack"
        file_path.write_bytes(compressed)

        # Store metadata in DB
        pack = ContentPack(
            id=pack_id,
            textbook_id=textbook_id,
            chapter=chapter,
            chapter_title=f"Chapter {chapter}",
            version="2025.1",
            file_path=str(file_path),
            size_bytes=len(compressed),
        )
        db.add(pack)
        await db.commit()

        return str(file_path)
