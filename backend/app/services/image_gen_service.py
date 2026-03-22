import logging
from .gemini_service import GeminiService

logger = logging.getLogger(__name__)


class ImageGenService:
    """
    Generates educational visuals using multiple strategies:
    1. Mermaid.js diagrams (rendered client-side)
    2. Rich textual descriptions for canvas rendering
    3. SVG for simple shapes (if applicable)
    """

    def __init__(self, gemini: GeminiService):
        self.gemini = gemini

    async def generate_educational_image(
        self, concept: str, subject: str, style: str = "diagram"
    ) -> dict:
        """
        Returns {type: "mermaid"|"description", content: str, alt_text: str}
        """
        # Determine if Mermaid is appropriate
        mermaid_concepts = ["cycle", "process", "flow", "steps", "stages", "pathway", "system", "how", "phases"]
        is_mermaid = any(kw in concept.lower() for kw in mermaid_concepts)

        if is_mermaid or style == "diagram":
            try:
                diagram_type = self._infer_diagram_type(concept)
                mermaid_code = await self.gemini.generate_mermaid_diagram(concept, diagram_type)
                alt_text = await self.gemini.generate_alt_text(concept)
                return {"type": "mermaid", "content": mermaid_code, "alt_text": alt_text, "diagram_type": diagram_type}
            except Exception as e:
                logger.error(f"Mermaid generation failed: {e}")

        # Fallback: rich description
        description = await self.gemini.generate_image_description(concept, subject)
        return {"type": "description", "content": description, "alt_text": f"Educational diagram of {concept}", "diagram_type": "description"}

    def _infer_diagram_type(self, concept: str) -> str:
        c = concept.lower()
        if any(kw in c for kw in ["cycle", "circular", "loop"]):
            return "graph"
        if any(kw in c for kw in ["compare", "difference", "versus", "vs"]):
            return "graph"
        if any(kw in c for kw in ["timeline", "history", "year", "century"]):
            return "timeline"
        if any(kw in c for kw in ["mind", "concept", "topics", "branches"]):
            return "mindmap"
        if any(kw in c for kw in ["sequence", "interaction", "message", "protocol"]):
            return "sequence"
        return "flowchart"

    async def generate_concept_map(self, central_concept: str, related_concepts: list[str]) -> str:
        return await self.gemini.generate_concept_map(central_concept, related_concepts)

    async def generate_process_flow(self, process_name: str, steps: list[str]) -> str:
        steps_str = "\n".join([f"Step {i+1}: {s}" for i, s in enumerate(steps)])
        prompt = f"""Generate a Mermaid flowchart for this process: "{process_name}"

Steps:
{steps_str}

Output ONLY valid Mermaid flowchart code, no explanation:"""
        text, _ = await self.gemini.generate_flash(prompt)
        text = text.strip()
        if text.startswith("```"):
            lines = text.split("\n")
            text = "\n".join(lines[1:-1] if lines[-1] == "```" else lines[1:])
        return text.strip()

    async def generate_comparison_table(self, item_a: str, item_b: str, attributes: list[str]) -> str:
        attrs = "\n".join([f"- {a}" for a in attributes])
        prompt = f"""Create a markdown comparison table between "{item_a}" and "{item_b}" for these attributes:
{attrs}

Use this exact format:
| Attribute | {item_a} | {item_b} |
|-----------|---------|---------|
| ... | ... | ... |

Output only the table, nothing else."""
        text, _ = await self.gemini.generate_flash(prompt)
        return text.strip()

    async def generate_timeline(self, events: list[dict]) -> str:
        """events: [{year, event}]"""
        events_str = "\n".join([f"{e.get('year', 'N/A')}: {e.get('event', '')}" for e in events])
        prompt = f"""Generate a Mermaid timeline (use gantt chart syntax) for these historical events:
{events_str}

Output ONLY valid Mermaid code:"""
        text, _ = await self.gemini.generate_flash(prompt)
        text = text.strip()
        if text.startswith("```"):
            lines = text.split("\n")
            text = "\n".join(lines[1:-1] if lines[-1] == "```" else lines[1:])
        return text.strip()
