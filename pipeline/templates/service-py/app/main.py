"""The website's API service: every page of the website (and any app or partner) reads and
changes data only through these addresses. The website itself never touches the database.

Layout (see service/README.md): core/ (settings, database, security, errors), api/ (shared
dependencies, the router list), modules/<resource>/ (router -> service -> repository -> models)."""

import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.router import api_router
from .core import errors
from .core.config import API_PREFIX, get_settings

# Windows: the preview starts this service in its own process group, which switches Ctrl+C off for
# every process in it. uvicorn --reload restarts the server by sending it Ctrl+C, so switch it back on.
if sys.platform == "win32":
    try:
        import ctypes

        ctypes.windll.kernel32.SetConsoleCtrlHandler(None, False)
    except Exception:  # never stop the service from starting over this
        pass

settings = get_settings()
app = FastAPI(title=settings.app_name, docs_url="/docs", redoc_url=None, openapi_url="/openapi.json",
              redirect_slashes=False)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["Health"])
def health():
    """The platform and Deployment check this to know the service is up (outside the version prefix)."""
    return {"ok": True}


app.include_router(api_router, prefix=API_PREFIX)
errors.register(app)
