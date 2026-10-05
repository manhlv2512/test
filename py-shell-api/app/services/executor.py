"""Service for safely running configured or caller-selected executables."""

from __future__ import annotations

import os
import subprocess
import time
from functools import lru_cache
from pathlib import Path
from typing import Any, Optional

from app.config import ScriptEntry, Settings, get_settings
from app.models import ExecuteResponse
from app.utils import get_logger

logger = get_logger()


class ScriptNotFoundError(Exception):
    """Raised when an action is not configured or its file does not exist."""


class ScriptAccessError(Exception):
    """Raised when a resolved path escapes the configured scripts directory."""


class ScriptNotExecutableError(Exception):
    """Raised when a selected file does not have execute permission."""


class ScriptExecutionError(Exception):
    """Raised when the operating system cannot start an executable."""


class ScriptExecutor:
    """Run executables with path checks, timeouts, and captured output."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def _resolve_path(self, requested_path: str, label: str) -> Path:
        """Resolve a path inside scripts_dir and validate the target file."""
        scripts_dir = self.settings.scripts_path.resolve()
        requested = Path(requested_path).expanduser()
        candidate = requested if requested.is_absolute() else scripts_dir / requested
        candidate = candidate.resolve()

        try:
            candidate.relative_to(scripts_dir)
        except ValueError as exc:
            raise ScriptAccessError(
                f"Executable '{label}' resolves outside scripts_dir."
            ) from exc

        if not candidate.is_file():
            raise ScriptNotFoundError(
                f"Executable '{label}' was not found at {candidate}."
            )

        if not os.access(candidate, os.X_OK):
            raise ScriptNotExecutableError(
                f"Executable '{label}' does not have execute permission: {candidate}."
            )

        return candidate

    def _resolve_configured_script(self, entry: ScriptEntry) -> Path:
        return self._resolve_path(entry.file, entry.name)

    def _clamp_timeout(self, requested: Optional[int]) -> int:
        timeout = requested if requested is not None else self.settings.default_timeout
        return max(1, min(timeout, self.settings.max_timeout))

    def _execute_file(
        self,
        *,
        script_path: Path,
        action_name: str,
        args: Optional[list[str]],
        timeout: Optional[int],
        payload: Optional[dict[str, Any]] = None,
    ) -> ExecuteResponse:
        safe_args = [str(arg) for arg in (args or [])]
        effective_timeout = self._clamp_timeout(timeout)

        # Execute directly rather than constructing a shell command. Scripts
        # therefore need a valid shebang and execute permission; native binaries
        # work as-is. argv values are never evaluated as shell syntax.
        command = [str(script_path), *safe_args]

        logger.info(
            "Executing action '{}' (path={}, args={}, timeout={}s, payload={})",
            action_name,
            script_path,
            safe_args,
            effective_timeout,
            payload or {},
        )

        start = time.monotonic()
        timed_out = False
        try:
            completed = subprocess.run(
                command,
                capture_output=True,
                text=True,
                timeout=effective_timeout,
                cwd=str(self.settings.project_root),
                check=False,
            )
            exit_code = completed.returncode
            stdout = completed.stdout
            stderr = completed.stderr
        except subprocess.TimeoutExpired as exc:
            timed_out = True
            exit_code = -1
            stdout = exc.stdout or ""
            stderr = (exc.stderr or "") + (
                f"\nExecutable timed out after {effective_timeout}s."
            )
            if isinstance(stdout, bytes):
                stdout = stdout.decode(errors="replace")
            if isinstance(stderr, bytes):
                stderr = stderr.decode(errors="replace")
            logger.error(
                "Action '{}' timed out after {}s.", action_name, effective_timeout
            )
        except (OSError, ValueError) as exc:
            logger.error("Could not start action '{}': {}", action_name, exc)
            raise ScriptExecutionError(
                f"Could not start executable '{action_name}': {exc}"
            ) from exc

        duration = round(time.monotonic() - start, 3)
        success = not timed_out and exit_code == 0

        logger.info(
            "Action '{}' finished: success={}, exit_code={}, duration={}s",
            action_name,
            success,
            exit_code,
            duration,
        )

        return ExecuteResponse(
            script=action_name,
            success=success,
            exit_code=exit_code,
            stdout=stdout,
            stderr=stderr,
            duration_seconds=duration,
            timed_out=timed_out,
        )

    def execute(
        self,
        name: str,
        args: Optional[list[str]] = None,
        timeout: Optional[int] = None,
    ) -> ExecuteResponse:
        """Run an action selected by its configured name."""
        entry = self.settings.script_by_name(name)
        if entry is None:
            raise ScriptNotFoundError(f"Action '{name}' is not configured.")

        script_path = self._resolve_configured_script(entry)

        safe_args = args or []
        if safe_args and not entry.allow_args:
            logger.warning(
                "Action '{}' does not allow args; ignoring {} provided arg(s).",
                name,
                len(safe_args),
            )
            safe_args = []

        return self._execute_file(
            script_path=script_path,
            action_name=name,
            args=safe_args,
            timeout=timeout,
        )

    def execute_path(
        self,
        path: str,
        *,
        name: Optional[str] = None,
        payload: Optional[dict[str, Any]] = None,
        args: Optional[list[str]] = None,
        timeout: Optional[int] = None,
    ) -> ExecuteResponse:
        """Run a caller-selected executable path contained by scripts_dir."""
        action_name = name or Path(path).name
        script_path = self._resolve_path(path, action_name)
        return self._execute_file(
            script_path=script_path,
            action_name=action_name,
            args=args,
            timeout=timeout,
            payload=payload,
        )


@lru_cache
def get_executor() -> ScriptExecutor:
    return ScriptExecutor(get_settings())
