import os
from pathlib import Path
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.models.negocio import Negocio
from app.models.usuario import Usuario
from app.core.security import hash_password, verificar_password
from app.core.config import settings


def ejecutar_migraciones_si_es_necesario() -> None:
    """Aplica migraciones de Alembic de forma automática e idempotente."""
    try:
        from alembic.config import Config
        from alembic import command

        possible_ini_paths = [
            Path(__file__).resolve().parent.parent.parent / "alembic.ini",
            Path.cwd() / "alembic.ini",
            Path.cwd() / "backend" / "alembic.ini",
        ]
        ini_path = None
        for p in possible_ini_paths:
            if p.exists():
                ini_path = p
                break

        if ini_path:
            cfg = Config(str(ini_path))
            alembic_dir = ini_path.parent / "alembic"
            cfg.set_main_option("script_location", str(alembic_dir))
            cfg.set_main_option("sqlalchemy.url", settings.clean_database_url)
            command.upgrade(cfg, "head")
            print("[Alembic] Migraciones sincronizadas a head.")
    except Exception as exc:
        print(f"[Alembic Notice] Migraciones automáticas omitidas o ya actualizadas: {exc}")


def asegurar_datos_iniciales() -> None:
    """Verifica y asegura que los negocios y usuarios iniciales existan con sus credenciales operativas.

    Se ejecuta de forma idempotente en el arranque del servidor para que el sistema
    funcione de inmediato en cualquier despliegue (Vercel, Railway, Render, Local) sin requerir
    ejecución manual de scripts de seed.
    """
    ejecutar_migraciones_si_es_necesario()

    db: Session = SessionLocal()
    try:
        # 1. Asegurar negocio Llantería (papá)
        llanteria = db.query(Negocio).filter(Negocio.rubro == "llanteria").first()
        if not llanteria:
            llanteria = Negocio(
                nombre=os.environ.get("LLANTERIA_NOMBRE", "Llantería"),
                rubro="llanteria",
                plan_estado="exento",
                modulos_activos={},
                modulo_rus_activo=True,
            )
            db.add(llanteria)
            db.flush()

        # 2. Asegurar negocio Lubricentro
        lubricentro = db.query(Negocio).filter(Negocio.rubro == "lubricentro").first()
        if not lubricentro:
            lubricentro = Negocio(
                nombre=os.environ.get("LUBRICENTRO_NOMBRE", "Lubricentro"),
                rubro="lubricentro",
                plan_estado="prueba",
                modulos_activos={"clientes_vehiculos": True},
                modulo_rus_activo=False,
            )
            db.add(lubricentro)
            db.flush()

        # 3. Cuentas operativas base
        cuentas = [
            (
                os.environ.get("ADMIN_USERNAME", "lincoln"),
                os.environ.get("ADMIN_PASSWORD", "admin123"),
                "admin",
                None,
                os.environ.get("ADMIN_NOMBRE", "Lincoln Vega Hidalgo"),
            ),
            (
                os.environ.get("LLANTERIA_USERNAME", "llanteria"),
                os.environ.get("LLANTERIA_PASSWORD", "dueno123"),
                "dueño",
                llanteria.id,
                os.environ.get("LLANTERIA_NOMBRE_USUARIO", "Llantería"),
            ),
            (
                os.environ.get("LUBRICENTRO_USERNAME", "lubricentro"),
                os.environ.get("LUBRICENTRO_PASSWORD", "dueno123"),
                "dueño",
                lubricentro.id,
                os.environ.get("LUBRICENTRO_NOMBRE_USUARIO", "Lubricentro"),
            ),
        ]

        for username, password_default, rol, neg_id, nombre in cuentas:
            usr = db.query(Usuario).filter(Usuario.username == username).first()
            if not usr:
                nuevo_usr = Usuario(
                    username=username,
                    nombre=nombre,
                    rol=rol,
                    negocio_id=neg_id,
                    password_hash=hash_password(password_default),
                    activo=True,
                )
                db.add(nuevo_usr)
            else:
                if not usr.activo:
                    usr.activo = True
                # Si la contraseña no coincide con la esperada, sincronizarla
                if not verificar_password(password_default, usr.password_hash):
                    usr.password_hash = hash_password(password_default)

        db.commit()
    except Exception as exc:
        db.rollback()
        print(f"[InitDB Warning] No se pudieron inicializar usuarios iniciales: {exc}")
    finally:
        db.close()
