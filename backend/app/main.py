from contextlib import asynccontextmanager
from urllib.parse import parse_qs, urlencode
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
# Vercel reescribe /(.*) a /api/index.py?__path=/$1.
# Este middleware extrae __path, restaura el path y raw_path original en el scope ASGI
# y limpia la query string para que FastAPI y OpenAPI despachen con exactitud.
@app.middleware("http")
async def vercel_routing_middleware(request: Request, call_next):
    query_raw = request.scope.get("query_string", b"").decode("latin-1")
    if "__path=" in query_raw:
        params = parse_qs(query_raw, keep_blank_values=True)
        raw_target = params.pop("__path", ["/"])[0]
        target_path = "/" + raw_target.lstrip("/")
        request.scope["path"] = target_path
        request.scope["raw_path"] = target_path.encode("utf-8")
        request.scope["query_string"] = urlencode(params, doseq=True).encode("latin-1")
    elif request.scope.get("path") in ("/api/index.py", "/api", "/api/index"):
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
