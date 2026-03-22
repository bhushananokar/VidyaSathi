import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.database import init_db

settings = get_settings()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ──────────────────────────────────────────────────────────────
    logger.info("Starting VidyaSathi backend...")

    # Create required local directories (uploads/content-packs; swap for object storage in prod)
    Path(settings.content_packs_dir).mkdir(exist_ok=True)
    Path("./uploads").mkdir(exist_ok=True)

    # Init database
    await init_db()
    logger.info("Database initialized")

    # Init services
    from app.services.gemini_service import GeminiService
    from app.services.groq_service import GroqService
    from app.services.chromadb_service import ChromaDBService
    from app.services.image_gen_service import ImageGenService
    from app.services.ingestion_service import IngestionService

    gemini = GeminiService()
    groq = GroqService()
    chromadb_svc = ChromaDBService()
    image_gen = ImageGenService(gemini)

    # Init Redis (optional — graceful fallback if not available)
    redis_client = None
    cache_svc = None
    try:
        import redis.asyncio as aioredis
        redis_client = aioredis.from_url(settings.redis_url, decode_responses=False, socket_connect_timeout=2)
        await redis_client.ping()
        from app.services.cache_service import CacheService
        cache_svc = CacheService(redis_client, gemini)
        logger.info("Redis connected — semantic cache active")
    except Exception as e:
        logger.warning(f"Redis not available ({e}). Semantic cache disabled.")
        # Provide a no-op cache
        from app.services.cache_service import CacheService

        class NullCache:
            async def get_cached_answer(self, *a, **kw): return None
            async def cache_answer(self, *a, **kw): pass
            async def warm_cache(self, *a, **kw): return 0
            async def get_cache_stats(self): return {"total_cached": 0}

        cache_svc = NullCache()

    ingestion_svc = IngestionService(gemini, chromadb_svc, cache_svc)

    from app.services.query_router import QueryRouter
    query_router = QueryRouter(gemini, cache_svc, chromadb_svc)

    # Attach to app state
    app.state.gemini_service = gemini
    app.state.groq_service = groq
    app.state.chromadb_service = chromadb_svc
    app.state.cache_service = cache_svc
    app.state.image_gen_service = image_gen
    app.state.ingestion_service = ingestion_svc
    app.state.query_router = query_router

    logger.info("All services initialized. VidyaSathi is ready!")

    yield

    # ── Shutdown ─────────────────────────────────────────────────────────────
    if redis_client:
        await redis_client.aclose()
    logger.info("VidyaSathi shutdown complete.")


app = FastAPI(
    title="VidyaSathi API",
    description="Offline-first AI tutor for India. Multi-tier cost optimization with Gemini + Groq.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Inject request into routers that need app.state
@app.middleware("http")
async def inject_request(request: Request, call_next):
    response = await call_next(request)
    return response


# Health check
@app.get("/health")
async def health():
    return {"status": "ok", "service": "VidyaSathi", "version": "1.0.0"}


@app.get("/api/health")
async def api_health():
    return {"status": "ok"}


# Register routers
from app.routers import auth, admin, analytics, offline, quiz, visual, notebook
from app.routers.query import router as query_router_module

# Patch routers to receive Request as first param for app.state access
import functools
from fastapi import APIRouter


def patch_router_for_request(router_instance):
    """Re-register routes with request injection."""
    pass  # Request is now handled via dependency injection below


app.include_router(auth.router, prefix="/api")
app.include_router(query_router_module, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(quiz.router, prefix="/api")
app.include_router(offline.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")
app.include_router(visual.router, prefix="/api")
app.include_router(notebook.router, prefix="/api")


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error: {exc}", exc_info=True)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
