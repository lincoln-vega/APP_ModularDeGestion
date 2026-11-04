from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

# Importa app.db.base para registrar TODOS los modelos en el registry de
# SQLAlchemy antes de que se configure cualquier mapper (los `relationship`
# entre modelos se resuelven por nombre de clase). Sin este import, un
# router que solo referencia un par de modelos puede fallar en runtime si
# esos modelos tienen relationship() hacia clases que nadie más importó.
from app.db import base as _base  # noqa: F401

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.init_db import asegurar_datos_iniciales


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Asegura cuentas operativas y negocios base de inmediato al arrancar el contenedor
    asegurar_datos_iniciales()
    yield


app = FastAPI(title="APP_ModularDeGestion API", version="0.1.3", lifespan=lifespan)

# Middleware de corrección de rutas para Vercel Serverless:
# Cuando Vercel reescribe /(.*) a /api/index.py, la cabecera x-matched-path
# contiene la URL original solicitada por el cliente (/api/v1/..., /docs, /).
# Restauramos el path original en el scope ASGI para que FastAPI despache la ruta exacta.
@app.middleware("http")
async def vercel_routing_middleware(request: Request, call_next):
    matched_path = request.headers.get("x-matched-path")
    scope_path = request.scope.get("path", "")
    if matched_path and scope_path in ("/api/index.py", "/api", "/api/index", "/api/index.py/"):
        request.scope["path"] = matched_path.split("?")[0]
    elif scope_path in ("/api/index.py", "/api/index"):
        request.scope["path"] = "/"
    return await call_next(request)


# CORS universal para soportar Cloudflare Pages (*.pages.dev), Vercel (*.vercel.app),
# dominios personalizados y red local en dispositivos móviles sin bloqueos de navegador.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_origin_regex=r"^https?://.*$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", tags=["health"])
@app.get("/health", tags=["health"])
def root_health():
    """Endpoint raíz y de verificación de salud para Vercel y monitores."""
    return {
        "status": "ok",
        "service": "APP_ModularDeGestion API",
        "version": "0.1.3",
        "docs": "/docs",
    }


app.include_router(api_router)
