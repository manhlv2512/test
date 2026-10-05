"""FastAPI application entrypoint for the Shell Script Execution API."""

from __future__ import annotations

from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI

from app.config import get_settings
from app.routes import scripts_router
from app.utils import get_logger, setup_logging

setup_logging()
logger = get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    logger.info(
        "Starting {} v{} (scripts_dir={})",
        settings.app.name,
        settings.app.version,
        settings.scripts_path,
    )
    logger.info("Registered scripts: {}", [s.name for s in settings.scripts])
    yield
    logger.info("Shutting down {}", settings.app.name)


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title=settings.app.name,
        version=settings.app.version,
        description="REST API to execute predefined .sh scripts on the server.",
        lifespan=lifespan,
    )

    app.include_router(scripts_router)

    @app.get("/", tags=["meta"])
    def root() -> dict:
        return {
            "name": settings.app.name,
            "version": settings.app.version,
            "docs": "/docs",
        }

    @app.get("/health", tags=["meta"])
    def health() -> dict:
        return {"status": "ok"}

    return app


app = create_app()


def main() -> None:
    settings = get_settings()
    uvicorn.run(
        "app.main:app",
        host=settings.app.host,
        port=settings.app.port,
        reload=False,
    )


if __name__ == "__main__":
    main()
