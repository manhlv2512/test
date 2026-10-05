"""Application settings loaded from config.yaml with environment overrides."""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Optional

import yaml
from pydantic import BaseModel, Field

# Project root = directory that contains config.yaml (two levels up from this file:
# app/config/settings.py -> app/config -> app -> project root)
PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CONFIG_PATH = PROJECT_ROOT / "config.yaml"


class AppInfo(BaseModel):
    name: str = "Shell Script Execution API"
    version: str = "1.0.0"
    host: str = "0.0.0.0"
    port: int = 8000


class LoggingConfig(BaseModel):
    level: str = "INFO"
    file: Optional[str] = "logs/shell-api.log"
    rotation: str = "10 MB"
    retention: str = "10 days"


class ScriptEntry(BaseModel):
    name: str
    file: str
    description: str = ""
    allow_args: bool = False


class Settings(BaseModel):
    app: AppInfo = Field(default_factory=AppInfo)
    scripts_dir: str = "scripts"
    default_timeout: int = 60
    max_timeout: int = 600
    api_key: Optional[str] = None
    logging: LoggingConfig = Field(default_factory=LoggingConfig)
    scripts: list[ScriptEntry] = Field(default_factory=list)

    @property
    def project_root(self) -> Path:
        return PROJECT_ROOT

    @property
    def scripts_path(self) -> Path:
        p = Path(self.scripts_dir)
        return p if p.is_absolute() else (PROJECT_ROOT / p)

    def script_by_name(self, name: str) -> Optional[ScriptEntry]:
        for entry in self.scripts:
            if entry.name == name:
                return entry
        return None


def _load_yaml(path: Path) -> dict:
    if not path.exists():
        return {}
    with path.open("r", encoding="utf-8") as fh:
        return yaml.safe_load(fh) or {}


def _apply_env_overrides(data: dict) -> dict:
    """Allow a few key settings to be overridden by environment variables."""
    api_key = os.getenv("X_API_KEY") or os.getenv("SHELL_API_KEY")
    if api_key:
        data["api_key"] = api_key

    scripts_dir = os.getenv("SHELL_API_SCRIPTS_DIR")
    if scripts_dir:
        data["scripts_dir"] = scripts_dir

    # Override each configured script file with
    # SHELL_API_SCRIPT_<NORMALIZED_SCRIPT_NAME>. For example:
    #   deploy   -> SHELL_API_SCRIPT_DEPLOY
    #   db-reset -> SHELL_API_SCRIPT_DB_RESET
    # Script names remain defined in config.yaml; only their file paths are
    # overridden. This keeps the action allowlist explicit.
    for script in data.get("scripts", []):
        if not isinstance(script, dict) or not script.get("name"):
            continue
        normalized_name = "".join(
            char if char.isalnum() else "_" for char in str(script["name"])
        ).strip("_").upper()
        script_file = os.getenv(f"SHELL_API_SCRIPT_{normalized_name}")
        if script_file:
            script["file"] = script_file

    port = os.getenv("SHELL_API_PORT")
    if port:
        data.setdefault("app", {})
        data["app"]["port"] = int(port)

    log_level = os.getenv("SHELL_API_LOG_LEVEL")
    if log_level:
        data.setdefault("logging", {})
        data["logging"]["level"] = log_level

    return data


@lru_cache
def get_settings() -> Settings:
    config_path = Path(os.getenv("SHELL_API_CONFIG", str(DEFAULT_CONFIG_PATH)))
    data = _load_yaml(config_path)
    data = _apply_env_overrides(data)
    return Settings(**data)
