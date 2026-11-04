import os
from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool

from app.core.config import settings

# En entornos serverless (Vercel) o producción, NullPool evita agotar el límite de conexiones en Neon/PostgreSQL
engine_kwargs = {"pool_pre_ping": True}
if os.environ.get("VERCEL") or settings.env == "production":
    engine_kwargs["poolclass"] = NullPool

engine = create_engine(settings.clean_database_url, **engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator:
    """Dependency de FastAPI: entrega una sesión de DB por request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
