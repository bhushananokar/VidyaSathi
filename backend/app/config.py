from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # AI Keys
    gemini_api_key: str = ""
    groq_api_key: str = ""

    # PostgreSQL (e.g. Supabase, Neon, Railway)
    database_url: str = "postgresql+asyncpg://user:password@host:5432/vidyasathi"

    # Upstash Redis (rediss:// for TLS)
    redis_url: str = "rediss://default:password@host.upstash.io:6379"

    # ChromaDB Cloud (chroma.app) or self-hosted
    chroma_host: str = "api.trychroma.com"
    chroma_port: int = 443
    chroma_ssl: bool = True
    chroma_api_key: str = ""
    chroma_tenant: str = "default_tenant"
    chroma_database: str = "default_database"

    # JWT
    secret_key: str = "change-this-in-production-min-32-chars!!"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days

    # File storage (local; swap for S3/GCS bucket path in prod)
    content_packs_dir: str = "./content_packs"

    # CORS — comma-separated origins
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    # Gemini models
    gemini_flash_model: str = "gemini-1.5-flash"
    gemini_pro_model: str = "gemini-1.5-pro"
    gemini_embedding_model: str = "models/text-embedding-004"

    # Semantic cache similarity threshold
    semantic_cache_threshold: float = 0.92

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    return Settings()
