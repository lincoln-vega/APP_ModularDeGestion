# 🛠️ APP_ModularDeGestion

> **Sistema de Gestión Modular Multi-Tenant y Offline-First para Talleres, Llanterías y Comercios.**  
> Diseñado desde la base para ser **ultra-intuitivo, táctil y accesible**, permitiendo que cualquier persona —incluyendo adultos mayores o trabajadores no familiarizados con la tecnología— pueda operar el inventario, registrar ventas y cerrar caja sin complicaciones.

---

## 📌 Visión y Propósito

En los talleres mecánicos y negocios de barrio de Perú (llanterías, lubricentros, servicios automotrices), el software tradicional suele fallar por ser demasiado complejo, rígido o exigir conexión permanente a internet. 

**APP_ModularDeGestion** resuelve esto mediante:
1. **Regla de Dos Bolsillos:** Distinción contable estricta entre **Capital** (costo de reposición que nunca debe gastarse) y **Ganancia Limpia / Mano de Obra** (dinero disponible para gastos personales del dueño).
2. **Interfaz Táctil Guiada:** Formularios asistidos donde no se escribe a menos que sea necesario; botones táctiles grandes para tamaños de aro, marcas comerciales, medidas populares y reposición rápida en 1 toque (+1, +2, +4, +10).
3. **Resiliencia Offline-First:** Si se corta la conexión o la señal móvil en el taller, las ventas y movimientos se encolan localmente en IndexedDB y se sincronizan automáticamente con el servidor al volver internet.
4. **Multi-Tenant Modular:** Un solo núcleo backend y base de datos capaz de servir a múltiples negocios independientes con módulos configurables bajo demanda.

---

## 🚀 Módulos del Sistema

### 1. 🛞 Stock e Inventario Táctil
- **Asistente de Catálogo Rápido:** Selección guiada de llantas por diámetro de Aro (`Aro 13` a `16`), Medida comercial (`185/65 R15`, `195/65 R15`, etc.) y Marcas líderes (`Goodyear`, `Michelin`, `Bridgestone`, `Linglong`, `Westlake`).
- **Botones Dinámicos Inline:** Opciones táctiles directas para `+ Otro aro`, `+ Otra medida` y `+ Otra marca` (para marcas chinas o medidas especiales de camión/remolque).
- **Control de Estado:** Distinción clara entre neumáticos nuevos sellados y llantas de segunda / seminuevas con badges visuales.
- **Reabastecimiento en 1 Toque:** En el modal de edición, botones instantáneos `+1 Llanta`, `+2 Par`, `+4 Juego` o `+10 Lote` actualizan el stock físico sin cálculos manuales.
- **Detección Anti-Duplicados:** Algoritmo que previene registrar la misma medida o nombre con variaciones tipográficas.

### 2. ⚡ Punto de Venta (POS) y Movimientos
- Registro de venta en 3 toques: Selección de ítem → Elección de marca/medida → Método de pago (`Efectivo` o `Digital / Yape / Plin`).
- Alerta visual inmediata si una venta deja el stock por debajo del mínimo configurado.
- Soporte para venta de servicios directos (parchados, balanceos, mano de obra) sin alterar el stock de mercadería.

### 3. 💰 Cierre de Caja Inteligente
- Arqueo diario, semanal y mensual con desglose automático:
  - **Total Bruto Cobrado**
  - **Fondo de Reposición (Capital):** Dinero intocable destinado a pagar a los distribuidores de llantas o insumos.
  - **Ganancia Neta (Utilidad):** Margen comercial + Mano de obra de servicios.
  - **Desglose por canal:** Separación exacta entre dinero en cajón (efectivo) y saldo en cuenta bancaria/billetera digital (Yape / Plin).

### 4. 🧾 Régimen Tributario SUNAT (Nuevo RUS)
- Módulo opcional auditable para negocios peruanos en el Nuevo RUS:
  - Total de ventas acumuladas en el mes.
  - Total de compras auditadas a distribuidores registradas desde el botón *Comprar*.
  - Monitoreo del tope de categoría (Categoría 1 hasta S/ 5,000 / Categoría 2 hasta S/ 8,000).
  - Acceso directo al portal de pago de la cuota mensual de SUNAT cerca al vencimiento mensual.

### 5. 🚗 Clientes y Placas de Vehículos (Lubricentro)
- Búsqueda y registro rápido por número de placa peruana.
- Historial de cambios de aceite, kilometraje y servicios aplicados al vehículo.
- Disparador de notificaciones y recordatorios preventivos de mantenimiento por WhatsApp.

---

## 🛠️ Stack Tecnológico

| Capa | Tecnologías |
| :--- | :--- |
| **Backend API** | Python 3.12, FastAPI, SQLAlchemy 2.0, Alembic, Uvicorn |
| **Base de Datos** | PostgreSQL 16 (Relacional, Multi-Tenant por columna `negocio_id`) |
| **Frontend PWA** | React 19, TypeScript, Vite 5, Service Workers (PWA offline), CSS Modules |
| **Diseño Visual** | Warm Minimalist táctil (`#1B4332` bosque, `#FAF9F5` hueso, `#191C1E` tinta) |
| **Contenedores** | Podman / Docker (PostgreSQL + FastAPI en red aislada) |

---

## 📦 Estructura del Repositorio

```
APP_ModularDeGestion/
├── backend/                  # API REST en FastAPI
│   ├── alembic/              # Migraciones de base de datos
│   ├── app/
│   │   ├── api/v1/           # Endpoints REST (auth, stock, ventas, caja, rus)
│   │   ├── core/             # Reglas contables, seguridad JWT y configuración
│   │   ├── models/           # Modelos SQLAlchemy (negocios, productos, movimientos...)
│   │   └── schemas/          # Esquemas de validación Pydantic
│   └── scripts/              # Seeders de inicio y cuentas reales
├── frontend/                 # Aplicación Web Progresiva (PWA)
│   ├── src/
│   │   ├── api/              # Cliente HTTP tipado con interceptor de auth y offline
│   │   ├── components/       # Componentes visuales accesibles y táctiles
│   │   ├── data/             # Catálogos de fábrica, medidas y aros comerciales
│   │   ├── pages/            # Vistas principales (Stock, Inicio, Cierre, SUNAT)
│   │   └── styles/           # Tokens CSS de identidad visual y tipografía
│   └── public/               # Manifiesto PWA e iconos de aplicación
└── docs/                     # Arquitectura de dominio y contrato OpenAPI
```

---

## 🚀 Puesta en Marcha Rápida (Local)

### Requisitos Previos
- [Podman](https://podman.io/) o [Docker](https://www.docker.com/)
- [Node.js](https://nodejs.org/) v18+ y `npm`
- [Python](https://www.python.org/) 3.12+

### 1. Iniciar Base de Datos y Backend

Si utilizas contenedores:
```bash
# Iniciar contenedor de base de datos PostgreSQL
podman run -d --name postgres_gestion -p 5432:5432 -e POSTGRES_DB=app_modulardegestion -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres postgres:16-alpine

# O ejecutar el backend localmente con virtualenv:
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
python scripts/seed_admin_y_negocios.py
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. Iniciar el Frontend (PWA)

```bash
cd frontend
npm install
npm run dev
```

La aplicación estará lista en:
- **Frontend Web / PWA:** `http://localhost:5173/`
- **API Swagger / Docs:** `http://localhost:8000/docs`
- **Health Check API:** `http://localhost:8000/api/v1/health`

---

## 🧪 Pruebas y Compilación

Para compilar el frontend y validar que no haya discrepancias de tipos de TypeScript:
```bash
cd frontend
npm run build
```

Para correr las pruebas unitarias del backend:
```bash
cd backend
pytest tests/
```

---

## 📄 Licencia

Desarrollado por **Lincoln Vega Hidalgo** para talleres y negocios independientes. Todos los derechos reservados.
