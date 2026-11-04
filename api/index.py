import os
import sys
from pathlib import Path

# Añadir backend al sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = ROOT_DIR / "backend"

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("PYTHONPATH", str(BACKEND_DIR))

from app.main import app
