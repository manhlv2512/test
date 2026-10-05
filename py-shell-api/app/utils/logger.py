"""Loguru-based logging setup for the Shell Script Execution API."""

from __future__ import annotations

import sys
from pathlib import Path

from loguru import logger

from app.config import get_settings

_configured = False


def setup_logging() -> None:
    """Configure Loguru sinks from application settings. Idempotent."""
    global _configured
    if _configured:
        return

    settings = get_settings()
    log_cfg = settings.logging

    logger.remove()

    log_format = (
        "<green>{time:YYYY-MM-DD HH:mm:ss.SSS}</green> | "
        "<level>{level: <8}</level> | "
        "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - "
        "<level>{message}</level>"
    )

    # Always log to stderr
    logger.add(
        sys.stderr,
        level=log_cfg.level,
        format=log_format,
        backtrace=True,
        diagnose=False,
    )

    # Optional rotating file sink
    if log_cfg.file:
        log_path = Path(log_cfg.file)
        if not log_path.is_absolute():
            log_path = settings.project_root / log_path
        log_path.parent.mkdir(parents=True, exist_ok=True)
        logger.add(
            str(log_path),
            level=log_cfg.level,
            format=log_format,
            rotation=log_cfg.rotation,
            retention=log_cfg.retention,
            enqueue=True,
            backtrace=True,
            diagnose=False,
        )

    _configured = True
    logger.debug("Logging configured (level={})", log_cfg.level)


def get_logger():
    """Return the configured Loguru logger."""
    if not _configured:
        setup_logging()
    return logger
