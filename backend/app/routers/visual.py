from fastapi import APIRouter, Depends, Request
from ..models.schemas import DiagramRequest, DiagramResponse, ConceptMapRequest, FlowchartRequest, ImageRequest
from ..utils.auth import get_current_student
from ..services.image_gen_service import ImageGenService

router = APIRouter(prefix="/visual", tags=["visual"])

DIAGRAM_TEMPLATES = [
    {"id": "water-cycle", "name": "Water Cycle", "description": "Complete hydrological cycle", "example": "flowchart TD\n  A[☀️ Sun] --> B[Evaporation]\n  B --> C[☁️ Cloud Formation]\n  C --> D[🌧️ Precipitation]\n  D --> E[Runoff]\n  E --> A"},
    {"id": "cell-division", "name": "Cell Division", "description": "Mitosis phases", "example": "flowchart LR\n  A[Interphase] --> B[Prophase]\n  B --> C[Metaphase]\n  C --> D[Anaphase]\n  D --> E[Telophase]\n  E --> F[Cytokinesis]"},
    {"id": "food-chain", "name": "Food Chain", "description": "Ecosystem energy flow", "example": "graph LR\n  A[🌱 Plants] --> B[🐛 Herbivores]\n  B --> C[🦊 Carnivores]\n  C --> D[🦁 Apex Predators]"},
    {"id": "rock-cycle", "name": "Rock Cycle", "description": "Geological rock formation", "example": "graph TD\n  A[Igneous Rock] --> B[Weathering]\n  B --> C[Sedimentary Rock]\n  C --> D[Metamorphic Rock]\n  D --> A"},
]


@router.post("/diagram", response_model=DiagramResponse)
async def generate_diagram(
    req: DiagramRequest,
    request: Request,
    student=Depends(get_current_student),
):
    svc: ImageGenService = request.app.state.image_gen_service
    result = await svc.generate_educational_image(req.concept, req.subject, "diagram")
    return DiagramResponse(
        type=result["type"],
        content=result["content"],
        alt_text=result["alt_text"],
        diagram_type=result.get("diagram_type", req.diagram_type),
    )


@router.post("/concept-map", response_model=DiagramResponse)
async def generate_concept_map(
    req: ConceptMapRequest,
    request: Request,
    student=Depends(get_current_student),
):
    svc: ImageGenService = request.app.state.image_gen_service
    mermaid_code = await svc.generate_concept_map(req.central_concept, req.related_concepts)
    return DiagramResponse(
        type="mermaid",
        content=mermaid_code,
        alt_text=f"Mind map of {req.central_concept}",
        diagram_type="mindmap",
    )


@router.post("/image", response_model=DiagramResponse)
async def generate_image(
    req: ImageRequest,
    request: Request,
    student=Depends(get_current_student),
):
    svc: ImageGenService = request.app.state.image_gen_service
    result = await svc.generate_educational_image(req.concept, req.subject, req.style)
    return DiagramResponse(
        type=result["type"],
        content=result["content"],
        alt_text=result.get("alt_text", f"Educational image of {req.concept}"),
        diagram_type=result.get("diagram_type", "diagram"),
    )


@router.post("/flowchart", response_model=DiagramResponse)
async def generate_flowchart(
    req: FlowchartRequest,
    request: Request,
    student=Depends(get_current_student),
):
    svc: ImageGenService = request.app.state.image_gen_service
    mermaid_code = await svc.generate_process_flow(req.process_name, req.steps)
    return DiagramResponse(
        type="mermaid",
        content=mermaid_code,
        alt_text=f"Flowchart of {req.process_name}",
        diagram_type="flowchart",
    )


@router.get("/templates")
async def get_templates(student=Depends(get_current_student)):
    return DIAGRAM_TEMPLATES
