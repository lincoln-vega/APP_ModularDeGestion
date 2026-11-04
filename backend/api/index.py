import sys
from pathlib import Path

# Añadir backend al sys.path para resolución de módulos de app
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from app.main import app
