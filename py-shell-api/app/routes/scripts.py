"""REST endpoints for listing and running configured or selected executables."""

from __future__ import annotations

import hmac

from fastapi import APIRouter, Depends, Header, HTTPException, status

from app.config import Settings, get_settings
from app.models import (
    ExecutePathRequest,
    ExecuteRequest,
    ExecuteResponse,
    ScriptInfo,
    ScriptListResponse,
)
from app.services import (
    ScriptAccessError,
    ScriptExecutionError,
    ScriptNotExecutableError,
    ScriptNotFoundError,
    get_executor,
)
from app.utils import get_logger

logger = get_logger()

router = APIRouter(prefix="/scripts", tags=["scripts"])


def verify_api_key(
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
    settings: Settings = Depends(get_settings),
) -> None:
    """Validate X-API-Key when an API key is configured."""
    if settings.api_key and (
        not x_api_key or not hmac.compare_digest(x_api_key, settings.api_key)
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API key.",
        )


def require_api_key(
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
    settings: Settings = Depends(get_settings),
) -> None:
    """Require configured API-key authentication for path execution."""
    if not settings.api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Path execution is disabled until X_API_KEY is configured.",
        )
    if not x_api_key or not hmac.compare_digest(x_api_key, settings.api_key):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API key.",
        )


def _execution_http_error(exc: Exception) -> HTTPException:
    if isinstance(exc, ScriptAccessError):
        code = status.HTTP_403_FORBIDDEN
    elif isinstance(exc, ScriptNotFoundError):
        code = status.HTTP_404_NOT_FOUND
    else:
        code = status.HTTP_422_UNPROCESSABLE_ENTITY
    return HTTPException(status_code=code, detail=str(exc))


@router.get("", response_model=ScriptListResponse)
def list_scripts(settings: Settings = Depends(get_settings)) -> ScriptListResponse:
    """List all configured actions."""
    scripts = [
        ScriptInfo(
            name=entry.name,
            file=entry.file,
            description=entry.description,
            allow_args=entry.allow_args,
        )
        for entry in settings.scripts
    ]
    return ScriptListResponse(scripts=scripts)


@router.get("/{name}", response_model=ScriptInfo)
def get_script(name: str, settings: Settings = Depends(get_settings)) -> ScriptInfo:
    """Get metadata for one configured action."""
    entry = settings.script_by_name(name)
    if entry is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Action '{name}' is not configured.",
        )
    return ScriptInfo(
        name=entry.name,
        file=entry.file,
        description=entry.description,
        allow_args=entry.allow_args,
    )


def _run_configured(
    name: str, payload: ExecuteRequest | None
) -> ExecuteResponse:
    """Run a configured action and translate execution errors to HTTP errors."""
    request = payload or ExecuteRequest()
    try:
        return get_executor().execute(
            name=name,
            args=request.args,
            timeout=request.timeout,
        )
    except (
        ScriptAccessError,
        ScriptExecutionError,
        ScriptNotExecutableError,
        ScriptNotFoundError,
    ) as exc:
        logger.warning("Configured action '{}' failed: {}", name, exc)
        raise _execution_http_error(exc) from exc


@router.post(
    "/deploy",
    response_model=ExecuteResponse,
    dependencies=[Depends(verify_api_key)],
)
def deploy(payload: ExecuteRequest | None = None) -> ExecuteResponse:
    """Run the configured deploy action."""
    return _run_configured("deploy", payload)


@router.post(
    "/undeploy",
    response_model=ExecuteResponse,
    dependencies=[Depends(verify_api_key)],
)
def undeploy(payload: ExecuteRequest | None = None) -> ExecuteResponse:
    """Run the configured undeploy action."""
    return _run_configured("undeploy", payload)


@router.post(
    "/restart",
    response_model=ExecuteResponse,
    dependencies=[Depends(verify_api_key)],
)
def restart(payload: ExecuteRequest | None = None) -> ExecuteResponse:
    """Run the configured restart action."""
    return _run_configured("restart", payload)


@router.post(
    "/execute",
    response_model=ExecuteResponse,
    dependencies=[Depends(require_api_key)],
)
def execute_path(payload: ExecutePathRequest) -> ExecuteResponse:
    """Run an executable path supplied in the request body."""
    try:
        return get_executor().execute_path(
            path=payload.path,
            name=payload.name,
            payload=payload.payload,
            args=payload.args,
            timeout=payload.timeout,
        )
    except (
        ScriptAccessError,
        ScriptExecutionError,
        ScriptNotExecutableError,
        ScriptNotFoundError,
    ) as exc:
        logger.warning(
            "Path action '{}' failed for '{}': {}",
            payload.name or "<unnamed>",
            payload.path,
            exc,
        )
        raise _execution_http_error(exc) from exc
