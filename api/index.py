import sys
from pathlib import Path

# Add project root to sys.path so 'backend' module is resolvable in Vercel serverless environment
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

try:
    from backend.main import app  # noqa: E402
except Exception:
    import traceback
    from fastapi import FastAPI
    from fastapi.responses import PlainTextResponse

    error_trace = traceback.format_exc()
    app = FastAPI(title="Skill Gap Analyzer Diagnostic")

    @app.api_route("/{full_path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"])
    async def startup_error_fallback(full_path: str):
        return PlainTextResponse(
            f"Vercel Startup Error in backend:\n\n{error_trace}",
            status_code=500,
        )

# Export ASGI app as 'app' and 'handler' for Vercel Python runtime compatibility
handler = app
