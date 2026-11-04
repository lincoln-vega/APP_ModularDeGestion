# Despliegue

Stack elegido: nube gestionada, gratuita (US$0/mes) — Neon (Postgres),
Vercel Serverless (backend FastAPI), Cloudflare Pages (frontend PWA React).
También compatible con Render o Railway si se prefiere contenedor.

Orden recomendado: base de datos → backend → frontend (el frontend necesita
la URL real del backend para `VITE_API_URL`).

## 1. Base de datos — Neon (PostgreSQL Serverless)

1. Crear cuenta en [neon.tech](https://neon.tech), crear un proyecto.
2. Copiar el connection string (formato `postgresql://...`).
3. Ese valor va como `DATABASE_URL` del backend.

## 2. Backend — Vercel Serverless (Recomendado, no se duerme)

El backend cuenta con soporte nativo para Vercel Serverless Functions (`api/index.py` y `vercel.json`), gestionando migraciones de Alembic y seed idempotente automáticamente al arrancar.

1. Ir a [vercel.com](https://vercel.com) e importar el repositorio de GitHub.
2. Configuración de importación:
   - **Framework Preset**: `Other`
   - **Root Directory**: Puede dejarse en `./` (raíz) o seleccionar `backend`. Ambas opciones están soportadas con `api/index.py` y `vercel.json`.
3. Variables de entorno en Vercel (**Settings > Environment Variables**):
   - `DATABASE_URL`: Connection string de Neon (ej: `postgresql://user:pass@ep-xyz.us-east-2.aws.neon.tech/neondb?sslmode=require`).
   - `JWT_SECRET_KEY`: Cadena segura aleatoria (`python3 -c "import secrets; print(secrets.token_urlsafe(48))"`).
   - `ENV`: `production`
4. Hacer clic en **Deploy**.
5. Vercel asignará una URL pública (ejemplo: `https://app-modular-backend.vercel.app`).
   - Puedes abrir `https://<tu-proyecto>.vercel.app/` en el navegador para ver `{"status": "ok"}`.
   - La documentación interactiva de Swagger estará en `https://<tu-proyecto>.vercel.app/docs`.

### Alternativa Backend con Contenedores (Render / Railway)
Si se prefiere Docker, el repositorio mantiene `backend/Dockerfile` y `railway.json`.

## 3. Frontend — Cloudflare Pages

1. En el dashboard de Cloudflare Pages, ir a la configuración del proyecto existente o importar el repo.
2. Variables de entorno de Cloudflare Pages:
   - `VITE_API_URL`: La URL del backend de Vercel (ejemplo: `https://app-modular-backend.vercel.app` o `https://app-modular-backend.vercel.app/api/v1`).
3. Re-desplegar para que el frontend apunte al nuevo backend serverless.

## 4. Credenciales de Acceso Iniciales
El backend auto-inicializa idempotentemente:
- **Admin**: `lincoln` / `admin123`
- **Llantería** (Papá): `llanteria` / `dueno123`
- **Lubricentro**: `lubricentro` / `dueno123`

## Pendiente transversal (no bloquea el primer deploy)

- Auth: login con JWT ya implementado (`app/core/auth.py`), pero sin
  refresh token ni recuperación de contraseña — si alguien pierde la
  suya, la única salida hoy es que un admin la recree a mano.
- CORS del backend debe incluir el dominio real de Cloudflare Pages una
  vez que exista (`*.pages.dev` o el dominio propio), no solo `localhost`.
