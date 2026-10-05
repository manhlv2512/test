"""Pydantic request/response models for the execution API."""

from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


class ExecuteRequest(BaseModel):
    """Body for executing a configured action."""

    args: list[str] = Field(
        default_factory=list,
        description="Positional arguments passed to the executable.",
        examples=[["--env", "staging"]],
    )
    timeout: Optional[int] = Field(
        default=None,
        ge=1,
        description="Execution timeout in seconds. Bounded by max_timeout in config.",
        examples=[120],
    )


class ExecutePathRequest(ExecuteRequest):
    """Body for executing a path supplied by the caller."""

    path: str = Field(
        min_length=1,
        description=(
            "Executable path, either relative to scripts_dir or absolute within "
            "scripts_dir."
        ),
        examples=["tools/custom-deploy"],
    )
    name: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=128,
        description="Optional action label written to execution logs.",
        examples=["custom-deploy"],
    )
    payload: dict[str, Any] = Field(
        default_factory=dict,
        description=(
            "Optional structured metadata written to logs. It is not passed to "
            "the executable."
        ),
        examples=[{"service": "api", "environment": "staging"}],
    )


class ExecuteResponse(BaseModel):
    """Result of an executable invocation."""

    script: str = Field(description="Configured action name or supplied log name.")
    success: bool = Field(description="True when the process exited with code 0.")
    exit_code: int = Field(description="Process exit code (-1 on timeout).")
    stdout: str = Field(default="", description="Captured standard output.")
    stderr: str = Field(default="", description="Captured standard error.")
    duration_seconds: float = Field(description="Wall-clock execution time.")
    timed_out: bool = Field(default=False, description="True when killed by timeout.")


class ScriptInfo(BaseModel):
    """Metadata about a configured action."""

    name: str
    file: str
    description: str = ""
    allow_args: bool = False


class ScriptListResponse(BaseModel):
    """List of configured actions."""

    scripts: list[ScriptInfo]
