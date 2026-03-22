import logging
import re
from .gemini_service import GeminiService, FLASH_COST_PER_1K, PRO_COST_PER_1K
from .cache_service import CacheService
from .chromadb_service import ChromaDBService

logger = logging.getLogger(__name__)

FACTUAL_KEYWORDS = ["what is", "define", "who is", "when was", "where is", "what are", "list", "name"]
REASONING_KEYWORDS = ["why", "explain why", "how does", "what causes", "compare", "difference between", "analyse", "evaluate"]
PROCEDURAL_KEYWORDS = ["how to", "steps to", "solve", "calculate", "find", "prove", "derive"]

DIAGRAM_TRIGGERS = ["process", "cycle", "steps", "flow", "structure", "stages", "pathway", "how", "phases", "compare", "system"]


def classify_query(question: str) -> str:
    q_lower = question.lower()
    if any(kw in q_lower for kw in REASONING_KEYWORDS):
        return "reasoning"
    if any(kw in q_lower for kw in PROCEDURAL_KEYWORDS):
        return "procedural"
    if any(kw in q_lower for kw in FACTUAL_KEYWORDS):
        return "factual"
    # Default: short = factual, long = reasoning
    return "factual" if len(question.split()) < 12 else "reasoning"


def should_generate_diagram(question: str, answer: str) -> bool:
    combined = (question + " " + answer).lower()
    return any(trigger in combined for trigger in DIAGRAM_TRIGGERS)


SUBJECT_CONTEXT = {
    "Science": "You are an expert science teacher for Indian students. Use relatable examples from Indian daily life.",
    "Mathematics": "You are an expert math teacher. Show step-by-step working. Use clear notation.",
    "History": "You are an expert history teacher. Focus on Indian history and relate to the curriculum.",
    "Geography": "You are an expert geography teacher. Use Indian geographical examples.",
    "default": "You are a helpful, accurate tutor for Indian school students.",
}

MODE_INSTRUCTIONS = {
    "ask": "Answer the question clearly and accurately.",
    "explain": "Explain this concept thoroughly, using analogies and examples a student can relate to.",
    "doubt": "The student has a doubt. First acknowledge their confusion, then clarify step by step. Check for prerequisite gaps.",
    "solve": "Solve this problem step by step. Show all working. Explain each step.",
    "quiz": "Generate a quiz question about this topic with 4 MCQ options and explain the correct answer.",
    "revision": "Provide a concise, exam-focused revision of this topic with key points and formulas.",
}

STYLE_MODIFIERS = {
    "visual": " Structure your response around diagrams and visual descriptions. Describe what a diagram would look like. Generate a Mermaid diagram if the concept involves a process or structure.",
    "auditory": " Explain this conversationally, as if you are speaking to the student. Use a friendly, dialogue-like tone.",
    "read_write": " Use structured bullet points, numbered lists, and clear headings. Include a summary at the end.",
    "kinesthetic": " Include a practical example or hands-on activity. Use 'try this yourself' prompts. Break into small doable steps.",
}


def build_system_prompt(subject: str, mode: str, learning_profile: dict) -> str:
    base = SUBJECT_CONTEXT.get(subject, SUBJECT_CONTEXT["default"])
    mode_instr = MODE_INSTRUCTIONS.get(mode, MODE_INSTRUCTIONS["ask"])

    # Determine dominant learning style
    dominant = max(learning_profile, key=learning_profile.get) if learning_profile else "read_write"
    style_mod = STYLE_MODIFIERS.get(dominant, "")

    return f"""{base}

{mode_instr}{style_mod}

Always:
- Be encouraging and patient
- Use simple language appropriate for the student's grade
- Reference textbook concepts when possible
- Keep response focused and not too long (unless solving requires it)
- If generating a Mermaid diagram, wrap it in ```mermaid code blocks"""


class QueryRouter:
    def __init__(
        self,
        gemini: GeminiService,
        cache: CacheService,
        chromadb: ChromaDBService,
    ):
        self.gemini = gemini
        self.cache = cache
        self.chromadb = chromadb

    async def route_query(
        self,
        question: str,
        subject: str,
        chapter: int | None,
        mode: str,
        conversation_history: list,
        learning_profile: dict,
        semantic_threshold: float = 0.92,
    ) -> dict:
        """
        Multi-tier routing:
        Tier 0: Exact cache match
        Tier 1: Semantic cache (embedding similarity)
        Tier 2: Gemini Flash + 2-3 RAG chunks
        Tier 3: Gemini Pro + 5-7 RAG chunks
        """

        # ─── Tier 0/1: Cache lookup ───────────────────────────────────────────
        cached = await self.cache.get_cached_answer(question, threshold=semantic_threshold)
        if cached:
            return {
                "answer": cached["answer"],
                "sources": [],
                "cost_tier": 1,
                "cached": True,
                "tokens_used": 0,
                "cost_usd": 0.0,
                "mermaid_diagram": None,
            }

        # ─── Classify query ───────────────────────────────────────────────────
        query_type = classify_query(question)
        is_multi_turn = len(conversation_history) > 0

        # ─── RAG retrieval ────────────────────────────────────────────────────
        query_emb = await self.gemini.embed_text(question)
        filters = {"textbook_id": {"$ne": ""}}
        if chapter:
            filters = {"chapter": chapter}

        n_chunks = 5 if query_type in ("reasoning", "procedural") or is_multi_turn else 3
        rag_results = await self.chromadb.search(query_emb, n_results=n_chunks, filters=None)

        context_parts = []
        sources = []
        for r in rag_results:
            context_parts.append(r["content"])
            meta = r.get("metadata", {})
            sources.append({
                "chapter": str(meta.get("chapter", "")),
                "chapter_title": meta.get("chapter_title", ""),
                "topic": meta.get("topic", ""),
                "page_no": meta.get("page_no"),
                "textbook": meta.get("subject", ""),
            })

        context = "\n\n".join(context_parts) if context_parts else ""

        # ─── Build conversation context ───────────────────────────────────────
        history_str = ""
        if conversation_history:
            recent = conversation_history[-4:]  # last 2 exchanges
            history_str = "\n".join([f"{m['role'].upper()}: {m['content']}" for m in recent])

        # ─── Build prompt ─────────────────────────────────────────────────────
        system = build_system_prompt(subject, mode, learning_profile)

        user_prompt = []
        if context:
            user_prompt.append(f"TEXTBOOK CONTEXT:\n{context}")
        if history_str:
            user_prompt.append(f"CONVERSATION HISTORY:\n{history_str}")
        user_prompt.append(f"STUDENT QUESTION: {question}")
        full_prompt = "\n\n".join(user_prompt)

        # ─── Tier 2: Flash ────────────────────────────────────────────────────
        use_pro = query_type in ("reasoning",) and len(question.split()) > 15
        if is_multi_turn:
            use_pro = True

        if use_pro:
            # Tier 3: Pro
            answer, tokens = await self.gemini.generate_pro(full_prompt, system)
            cost = self.gemini.calc_cost(tokens, "pro")
            cost_tier = 3
        else:
            # Tier 2: Flash
            answer, tokens = await self.gemini.generate_flash(full_prompt, system)
            cost = self.gemini.calc_cost(tokens, "flash")
            cost_tier = 2

        # ─── Extract Mermaid diagrams from answer ─────────────────────────────
        mermaid_diagram = None
        if "```mermaid" in answer:
            match = re.search(r"```mermaid\s*([\s\S]*?)```", answer)
            if match:
                mermaid_diagram = match.group(1).strip()
        elif should_generate_diagram(question, answer):
            # Auto-generate for visual learners
            dominant = max(learning_profile, key=learning_profile.get) if learning_profile else "read_write"
            if dominant == "visual":
                try:
                    mermaid_diagram = await self.gemini.generate_mermaid_diagram(question)
                except Exception:
                    pass

        # ─── Cache the result ─────────────────────────────────────────────────
        await self.cache.cache_answer(question, answer, {"subject": subject, "chapter": chapter})

        return {
            "answer": answer,
            "sources": sources,
            "cost_tier": cost_tier,
            "cached": False,
            "tokens_used": tokens,
            "cost_usd": cost,
            "mermaid_diagram": mermaid_diagram,
        }
