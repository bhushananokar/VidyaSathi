import logging
import asyncio
from typing import Optional
import google.generativeai as genai
from ..config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

FLASH_COST_PER_1K = 0.000075
PRO_COST_PER_1K = 0.00125


class GeminiService:
    def __init__(self):
        if settings.gemini_api_key:
            genai.configure(api_key=settings.gemini_api_key)
        self.flash_model = genai.GenerativeModel(settings.gemini_flash_model)
        self.pro_model = genai.GenerativeModel(settings.gemini_pro_model)

    async def _generate(self, model, prompt: str, system: str = "") -> tuple[str, int]:
        try:
            full_prompt = f"{system}\n\n{prompt}" if system else prompt
            response = await asyncio.to_thread(model.generate_content, full_prompt)
            text = response.text or ""
            tokens = getattr(response, "usage_metadata", None)
            token_count = (tokens.total_token_count if tokens else len(full_prompt.split()) * 1.3)
            return text, int(token_count)
        except Exception as e:
            logger.error(f"Gemini generation error: {e}")
            return self._fallback_response(prompt), 0

    def _fallback_response(self, prompt: str) -> str:
        return (
            "I'm currently unable to connect to my knowledge base. "
            "Please check your internet connection and API configuration. "
            "Your question has been noted and will be answered when connectivity is restored."
        )

    async def generate_flash(self, prompt: str, system: str = "") -> tuple[str, int]:
        return await self._generate(self.flash_model, prompt, system)

    async def generate_pro(self, prompt: str, system: str = "") -> tuple[str, int]:
        return await self._generate(self.pro_model, prompt, system)

    # Lazy-loaded local embedding model (all-MiniLM-L6-v2, 384-dim, ~90MB)
    _embedding_model = None

    @classmethod
    def _get_embedding_model(cls):
        if cls._embedding_model is None:
            from sentence_transformers import SentenceTransformer
            logger.info("Loading sentence-transformers embedding model...")
            cls._embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
            logger.info("Embedding model loaded.")
        return cls._embedding_model

    async def embed_text(self, text: str) -> list[float]:
        try:
            model = self._get_embedding_model()
            embedding = await asyncio.to_thread(model.encode, text, normalize_embeddings=True)
            return embedding.tolist()
        except Exception as e:
            logger.error(f"Embedding error: {e}")
            return [0.0] * 384

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        try:
            model = self._get_embedding_model()
            embeddings = await asyncio.to_thread(model.encode, texts, normalize_embeddings=True, batch_size=32)
            return [e.tolist() for e in embeddings]
        except Exception as e:
            logger.error(f"Batch embedding error: {e}")
            return [[0.0] * 384 for _ in texts]

    async def generate_mermaid_diagram(self, concept: str, diagram_type: str = "flowchart") -> str:
        """Generate valid Mermaid.js syntax for an educational concept."""
        type_instructions = {
            "flowchart": "Create a flowchart (TD direction) showing the process or steps. Use --> for arrows and [] for rectangles, {} for decisions.",
            "mindmap": "Create a mindmap with the concept as root. Use mindmap syntax with indentation.",
            "sequence": "Create a sequence diagram showing interactions. Use sequenceDiagram with participant declarations.",
            "timeline": "Create a timeline using gantt chart syntax showing historical sequence.",
            "graph": "Create a graph (LR direction) showing relationships between concepts.",
        }
        instruction = type_instructions.get(diagram_type, type_instructions["flowchart"])

        prompt = f"""Generate valid Mermaid.js code for: "{concept}"

Instructions: {instruction}

Rules:
- Output ONLY the Mermaid code, starting with the diagram type keyword
- No markdown code blocks, no explanation
- Keep labels concise (max 5 words each)
- Use simple, readable syntax
- Educational and accurate

Example flowchart format:
flowchart TD
    A[Start] --> B[Step 1]
    B --> C{{Decision}}
    C -->|Yes| D[Result A]
    C -->|No| E[Result B]

Now generate for "{concept}":"""

        text, _ = await self.generate_flash(prompt)
        # Clean up any accidental markdown wrapping
        text = text.strip()
        if text.startswith("```"):
            lines = text.split("\n")
            text = "\n".join(lines[1:-1] if lines[-1] == "```" else lines[1:])
        return text.strip()

    async def generate_concept_map(self, central_concept: str, related_concepts: list[str]) -> str:
        related_str = ", ".join(related_concepts[:8])
        prompt = f"""Generate a Mermaid mindmap for the concept "{central_concept}" with these related ideas: {related_str}

Output ONLY valid Mermaid mindmap syntax. No markdown blocks, no explanation.

Example:
mindmap
  root((Water Cycle))
    Evaporation
      Solar Energy
      Surface Water
    Condensation
      Cloud Formation
    Precipitation
      Rain
      Snow"""

        text, _ = await self.generate_flash(prompt)
        text = text.strip()
        if text.startswith("```"):
            lines = text.split("\n")
            text = "\n".join(lines[1:-1] if lines[-1] == "```" else lines[1:])
        return text.strip()

    async def generate_alt_text(self, concept: str) -> str:
        text, _ = await self.generate_flash(f"Describe in one sentence what a diagram of '{concept}' would show for a student:")
        return text.strip()

    async def generate_image_description(self, concept: str, subject: str = "Science") -> str:
        text, _ = await self.generate_flash(
            f"Describe in detail what an educational diagram illustrating '{concept}' in {subject} would look like. "
            f"Include: key labeled parts, arrows showing relationships, color suggestions, and layout. Keep it under 100 words."
        )
        return text.strip()

    def calc_cost(self, tokens: int, model_type: str = "flash") -> float:
        rate = PRO_COST_PER_1K if model_type == "pro" else FLASH_COST_PER_1K
        return (tokens / 1000) * rate
