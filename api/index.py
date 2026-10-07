import sys
from pathlib import Path

# Add project root to sys.path so 'backend' module is resolvable in Vercel serverless environment
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from backend.main import app  # noqa: E402

# Export ASGI app as 'app' and 'handler' for Vercel Python runtime compatibility
handler = app
