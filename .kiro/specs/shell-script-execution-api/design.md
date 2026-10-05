# Design Document

## Overview

The Shell Script Execution API is a Python 3.11+ service built on **FastAPI** and served by **Uvicorn**. It exposes two endpoints: an unauthenticated `GET /health` liveness probe and an authenticated `POST /execute` endpoint that runs a whitelisted shell script as a child process and returns the captured result.

The design mirrors the proven patterns of the existing TypeScript executor service in this workspace, translated to idiomatic Python:

- API-key authentication via the `x-api-key` header using a constant-time comparison (`secrets.compare_digest`), with auth bypass when the configured key is empty.
- A script whitelist mapping short identifiers to absolute paths, plus symlink-resolving path confinement.
- Argument validation against a strict safe character set to prevent command injection.
- Direct child-process invocation without a shell (`subprocess` with `shell=False`), per-execution timeout, and output-size capping.
- Environment-based, fail-fast configuration.
- Structured application logs (INFO/WARN/ERROR with ISO-8601 UTC timestamps and a trace id) plus a per-execution log file keyed by the trace id.
- A trace-id middleware that reuses a valid client-supplied `x-trace-id` or generates one.
- Native OpenAPI/Swagger documentation from FastAPI, with the `x-api-key` scheme applied to `/execute` and `/health` marked as requiring no auth.
- Docker Compose deployment with a restart policy, a `/health` probe, and persistent volume mounts for the data and log directories.
- A pytest test suite using FastAPI's `TestClient`.

Code examples use Python (the language detected from the request and consistent with a FastAPI project).

## Architecture

```
                         ┌──────────────────────────────────────────────┐
   HTTP Client  ─────►   │                 FastAPI app                    │
                         │                                                │
                         │  TraceMiddleware  (assign/echo x-trace-id)     │
                         │        │                                       │
                         │        ▼                                       │
                         │  ┌───────────────┐        ┌─────────────────┐  │
                         │  │ GET /health   │        │ POST /execute    │  │
                         │  │ (no auth)     │        │  Authenticator   │  │
                         │  └──────┬────────┘        │       │          │  │
                         │         │                 │       ▼          │  │
                         │         │                 │ ArgumentValidator│  │
                         │         │                 │       │          │  │
                         │         │                 │       ▼          │  │
                         │         │                 │ ScriptWhitelist  │  │
                         │         │                 │       │          │  │
                         │         │                 │       ▼          │  │
                         │         │                 │   Executor       │  │
                         │         │                 └───────┬─────────-┘  │
                         │         ▼                         ▼             │
                         │      Config (env, fail-fast)   Logger          │
                         │                              (app + exec log)  │
                         └──────────────────────────────────────────────┘
                                                          │
                                                          ▼
                                        LOG_DIR/executions/<ts>-<traceId>.log
```

Request flow for `POST /execute`:

1. `TraceMiddleware` assigns exactly one `Trace_Id` (reusing a valid `x-trace-id` or generating one) and echoes it in the response header.
2. The `Authenticator` dependency validates the `x-api-key` header (constant-time), or is bypassed when the configured key is empty.
3. The request body is parsed and validated by Pydantic; the `ArgumentValidator` enforces the safe character set and bounds.
4. The `ScriptWhitelist` resolves the `script` identifier to a confined, executable absolute path.
5. The `Executor` runs the script without a shell, enforcing the timeout and output cap.
6. The `Logger` writes an application log line and a per-execution log file named with the trace id.
7. The route maps the execution result to an HTTP status (200 on success, 500 on failure) and returns the result plus the trace id.

### Technology Choices

- **FastAPI + Uvicorn** — native OpenAPI/Swagger generation (Req 8), dependency injection for auth, and Pydantic validation.
- **Pydantic v2 `BaseModel` / `BaseSettings`** — request/response models and env-based config with type coercion and range validation.
- **`subprocess` (stdlib)** — process spawning with `shell=False` and argv list (Req 3.6, 4.5).
- **`secrets.compare_digest` (stdlib)** — constant-time key comparison (Req 2.3).
- **`pathlib` / `os` (stdlib)** — symlink resolution and confinement (Req 3.4), executability checks (Req 3.5).
- **`logging` (stdlib)** — structured application logging (Req 6.4).
- **pytest + `fastapi.testclient.TestClient`** — unit/integration tests (Req 10).

## Components and Interfaces

### Config (`app/config.py`)

Loads and validates all settings from environment variables at startup, failing fast (non-zero exit) on missing-required or invalid-integer/out-of-range values. Maps to Requirement 7.

Environment variables:

| Variable | Type | Default | Range / Rule | Requirement |
|---|---|---|---|---|
| `PORT` | int | `3000` | 1–65535 | 7.5 |
| `HOST` | str | `0.0.0.0` | — | 7.1 |
| `API_KEY` | str | `""` (empty → auth disabled) | — | 2.4, 7.2 |
| `EXEC_TIMEOUT_MS` | int | `60000` | ≥ 1000 | 5.1, 7.5 |
| `MAX_OUTPUT_BYTES` | int | `1048576` | ≥ 1024 | 5.3, 7.5 |
| `SCRIPTS` | str | `""` | whitelist config (see below) | 3.1, 7.1 |
| `WORK_DIR` | str | `/scripts` | — | 7.1 |
| `DATA_DIR` | str | `/data` | — | 7.1 |
| `LOG_DIR` | str | `/logs` | — | 7.1 |

`SCRIPTS` whitelist config format: a semicolon-separated list of `identifier=absolute_path` entries, e.g. `install=/scripts/install.sh;uninstall=/scripts/uninstall.sh`. Identifiers must match `^[A-Za-z0-9_-]{1,128}$`; paths must be absolute. Invalid entries abort startup naming the offending variable (Req 7.4).

```python
class Config:
    def __init__(self, env: Mapping[str, str]): ...

    @staticmethod
    def load(env: Mapping[str, str] = os.environ) -> "Config":
        """Parse and validate env. Raises ConfigError naming the offending
        variable on missing-required, non-integer, or out-of-range values."""
```

On `ConfigError`, `main` logs a startup ERROR line naming the variable and exits with a non-zero status (Req 7.3, 7.4).

### Authenticator (`app/auth.py`)

FastAPI dependency for `/execute`. Maps to Requirement 2.

```python
def require_api_key(config: Config):
    def dependency(request: Request) -> None:
        if config.api_key == "":
            return                      # auth disabled (Req 2.4)
        values = request.headers.getlist("x-api-key")
        if len(values) != 1:            # absent or duplicated (Req 2.2, 2.5)
            raise HTTPException(401, {"error": "invalid or missing x-api-key"})
        if not secrets.compare_digest(values[0], config.api_key):  # Req 2.1, 2.3
            raise HTTPException(401, {"error": "invalid or missing x-api-key"})
    return dependency
```

`secrets.compare_digest` performs a constant-time comparison and returns `False` on length mismatch, satisfying Req 2.3 without a separate length branch. On rejection the script never runs because the dependency raises before the handler body executes (Req 2.2). Not applied to `/health` (Req 1.2).

### ArgumentValidator (`app/args.py`)

Validates the `args` list against the safe character set and bounds. Maps to Requirement 4.

```python
SAFE_ARG = re.compile(r"^[\w@%+=:,./-]+$")
MAX_ARGS = 256
MAX_ARG_LEN = 4096

def validate_args(args: list[str] | None) -> list[str]:
    """Returns the validated tokens (empty list if args is None).
    Raises ArgError (→ HTTP 400) identifying the offending token/reason on:
      - not a list of strings, or > 256 elements                (Req 4.1, 4.2)
      - any token length outside 1..4096 (empty → rejected)     (Req 4.1, 4.6)
      - any token not matching SAFE_ARG                          (Req 4.3)
    """
```

Because `SAFE_ARG` requires one or more characters, an empty token is rejected (Req 4.6). Validated tokens are returned unchanged and forwarded to the executor as a discrete argv list (Req 4.5). Omitting `args` yields `[]` (Req 4.4).

### ScriptWhitelist (`app/whitelist.py`)

Resolves a client identifier to a confined, executable absolute path. Maps to Requirement 3.

```python
IDENTIFIER = re.compile(r"^[A-Za-z0-9_-]{1,128}$")

class ScriptWhitelist:
    def __init__(self, entries: dict[str, str]): ...

    def resolve(self, identifier: str) -> str:
        """Returns the absolute path to execute, or raises:
          - InvalidIdentifier (→ 400) if identifier fails IDENTIFIER   (Req 3.3)
          - NotWhitelisted    (→ 400) if identifier not in entries      (Req 3.2)
          - NotFound          (→ 404) if realpath is not a regular file
                                       or resolves outside its configured
                                       absolute path (symlink escape)   (Req 3.4)
          - NotExecutable     (→ 500) if the file is not executable      (Req 3.5)
        """
```

Confinement check: the configured path is normalised to an absolute path `configured`; the resolved real path (`os.path.realpath`) must be identical to `os.path.realpath(configured)` and be a regular file, otherwise `NotFound` is raised (Req 3.4). Executability is checked with `os.access(path, os.X_OK)` (Req 3.5).

### Executor (`app/executor.py`)

Runs the resolved script directly as a child process. Maps to Requirements 3.6 and 5.

```python
@dataclass
class ExecuteResult:
    trace_id: str
    command: str
    args: list[str]
    exit_code: int | None
    signal: str | None
    timed_out: bool
    stdout: str
    stderr: str
    started_at: str      # ISO-8601 UTC
    finished_at: str     # ISO-8601 UTC
    duration_ms: int     # >= 0

class Executor:
    def __init__(self, config: Config): ...

    def run(self, script_path: str, args: list[str], trace_id: str) -> ExecuteResult:
        """Spawns [script_path, *args] with shell=False (Req 3.6).
        Enforces EXEC_TIMEOUT_MS by killing the process group on timeout
        and setting timed_out=True (Req 5.2).
        Caps retained stdout/stderr at MAX_OUTPUT_BYTES each without failing
        the execution (Req 5.4, 5.5).
        On spawn failure sets exit_code=None with an error indication (Req 5.9)."""
```

Implementation notes:
- `subprocess.Popen([script_path, *args], shell=False, cwd=WORK_DIR, stdout=PIPE, stderr=PIPE, start_new_session=True)`. Passing the argv list with `shell=False` means client tokens are never interpreted by a shell (Req 3.6, 4.5).
- The child is started in a new session so a timeout can kill the whole process group with `SIGKILL` (Req 5.2).
- stdout/stderr are read incrementally and truncated to `MAX_OUTPUT_BYTES` bytes each; excess bytes are discarded without raising (Req 5.4, 5.5).
- `duration_ms` is computed from a monotonic clock and clamped to `>= 0` (Req 5.6).
- On `FileNotFoundError`/`PermissionError` at spawn, `exit_code` is `None` and `stderr` carries the error indication (Req 5.9).

### Logger (`app/logger.py`)

Structured application logging plus per-execution files. Maps to Requirement 6.

```python
class Logger:
    def __init__(self, log_dir: str): ...      # creates <log_dir>/executions

    def info(self, msg: str, trace_id: str) -> None: ...
    def warn(self, msg: str, trace_id: str) -> None: ...
    def error(self, msg: str, trace_id: str) -> None: ...

    def save_execution(self, trace_id: str, result: ExecuteResult) -> str:
        """Writes <log_dir>/executions/<iso-ts>-<trace_id>.log recording
        command, args, exit_code, signal, timed_out, duration_ms, stdout,
        stderr (Req 6.5). On write failure emits an ERROR line with the
        trace id and returns; the caller still returns the result (Req 6.6)."""
```

Application log lines are formatted as `<ISO-8601 UTC> <LEVEL> [<trace_id>] <message>` where `<LEVEL>` is exactly one of `INFO`, `WARN`, `ERROR` (Req 6.4). App logs go to stdout/stderr for the process manager to capture; execution records are always written to disk as the audit trail (Req 6.5).

### TraceMiddleware (`app/trace.py`)

ASGI middleware that assigns a trace id before any other processing. Maps to Requirement 6.1–6.3.

```python
TRACE_HEADER = "x-trace-id"
VALID_TRACE = re.compile(r"^[\w-]{1,64}$")

async def trace_middleware(request, call_next):
    incoming = request.headers.get(TRACE_HEADER)
    trace_id = incoming if incoming and VALID_TRACE.match(incoming) else generate_trace_id()
    request.state.trace_id = trace_id
    response = await call_next(request)
    response.headers[TRACE_HEADER] = trace_id
    return response
```

`generate_trace_id()` returns a value matching `^[\w-]{1,64}$` (e.g. 16 hex chars from `secrets.token_hex(8)`) (Req 6.2). Route handlers include the trace id in the JSON body so header and body agree (Req 6.3).

### API Layer (`app/main.py`)

FastAPI application wiring the middleware, routes, dependencies, and OpenAPI metadata.

- `GET /health` — no auth dependency (Req 1.2). Returns `{"status": "ok", "target": <identifier|null>, "traceId": ...}` within budget (Req 1.1, 1.3). If the target identifier dependency is unavailable, `target` is `null` and `status` stays `"ok"` with no internal detail leaked (Req 1.4). The health route is documented with an empty security requirement (Req 8.6).
- `POST /execute` — depends on `require_api_key`; validates body, resolves the whitelist, executes, logs, and maps the result to a status code (Req 5.7, 5.8).
- OpenAPI: FastAPI serves `/openapi.json` and Swagger UI at `/docs` natively (Req 8.1–8.4). An `APIKeyHeader` security scheme named `x-api-key` is declared and applied to `/execute` (Req 8.5).

## Data Models

Pydantic v2 models (`app/models.py`):

```python
class ExecuteRequest(BaseModel):
    script: str                      # Script_Identifier (Req 3.3)
    args: list[str] | None = None    # validated by ArgumentValidator (Req 4)

class ExecuteResponse(BaseModel):
    traceId: str
    script: str
    command: str
    args: list[str]
    exitCode: int | None
    signal: str | None
    timedOut: bool
    stdout: str
    stderr: str
    durationMs: int                  # >= 0 (Req 5.6)

class HealthResponse(BaseModel):
    status: str                      # "ok"
    target: str | None               # execution target identifier (Req 1.3/1.4)
    traceId: str

class ErrorResponse(BaseModel):
    error: str
    traceId: str
```

Response models are declared per status code so the OpenAPI schema documents both success and error outcomes (Req 8.1).

## Error Handling

A centralised exception mapping translates domain errors to HTTP responses; every error body includes the `error` field and the request `traceId` (Req 6.3), and the trace id is echoed in the `x-trace-id` header by the middleware.

| Condition | Exception | HTTP status | Requirement |
|---|---|---|---|
| Missing/invalid/duplicate `x-api-key` | `HTTPException(401)` | 401 | 2.2, 2.5 |
| Invalid identifier chars/length | `InvalidIdentifier` | 400 | 3.3 |
| Identifier not whitelisted | `NotWhitelisted` | 400 | 3.2 |
| Invalid `args` (shape/bounds/charset/empty) | `ArgError` | 400 | 4.2, 4.3, 4.6 |
| Script path missing / symlink escape | `NotFound` | 404 | 3.4 |
| Script not executable | `NotExecutable` | 500 | 3.5 |
| Non-zero exit or timeout | mapped from result | 500 | 5.8 |
| Spawn failure / no exit code | mapped from result | 500 | 5.9 |
| Success (exit 0, not timed out) | — | 200 | 5.7 |

Handlers do not leak internal stack traces or secret values (Req 1.3, 1.4). Whenever an error occurs before execution, the executor is never invoked (Req 2.2, 3.2, 3.3, 3.4, 3.5, 4.2, 4.3, 4.6).

## Docker Deployment

Maps to Requirement 9.

- **Dockerfile** — Python 3.11 slim base, installs `requirements.txt`, copies `app/`, runs `uvicorn app.main:app --host $HOST --port $PORT`.
- **docker-compose.yml**:
  - `restart: on-failure` (or `unless-stopped`) so the container restarts on failure/unexpected exit (Req 9.1).
  - `healthcheck` running an in-image probe of `GET /health` with **no** `x-api-key`, `interval: 30s`, `timeout: 10s`, `retries: 3` (Req 9.2–9.4).
  - Volume mounts for `DATA_DIR` and `LOG_DIR` so execution logs persist across restart/recreate (Req 9.5, 9.6).

## Testing Strategy

Dual approach with pytest and FastAPI's `TestClient`.

**Example / unit tests** (Req 10):
- `GET /health` → 200 with `status == "ok"` (Req 10.1); also passes with no/invalid key (Req 1.2).
- Authenticator accepts an exactly-matching key and forwards to the handler (Req 10.2); rejects missing/mismatched key with 401 and no handler invocation (Req 10.3).
- `ArgumentValidator` accepts an all-safe-token list and returns identical tokens (Req 10.4); rejects non-list / unsafe-token inputs → 400 (Req 10.5).
- Request for an absent identifier → 400 with a not-permitted error (Req 10.6).
- Edge cases: duplicate `x-api-key` header (2.5), non-executable file (3.5), empty-string token (4.6), spawn failure (5.9), execution-log write failure (6.6).
- Config: defaults applied (7.2), missing required aborts naming the var (7.3), boundary values for `EXEC_TIMEOUT_MS`/`MAX_OUTPUT_BYTES`/`PORT` (5.1, 5.3, 7.5).
- OpenAPI: `/openapi.json` documents both endpoints, the `x-api-key` scheme on `/execute`, and no auth on `/health` (8.1, 8.5, 8.6).

**Property-based tests** (see Correctness Properties) target argument validation, whitelist confinement, output capping, timeout, trace-id handling, status mapping, and config validation. Each property test runs a minimum of 100 iterations and is tagged `Feature: shell-script-execution-api, Property {number}: {property_text}`. Property tests use a controllable helper script and mocks (e.g. an in-process fake executor for status-mapping) to keep iterations cheap. Docker classification criteria (9.3, 9.4, 9.6) are verified by integration tests against a running container rather than property tests.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Non-matching API keys are rejected

*For any* string that is not byte-for-byte equal to the configured non-empty API key (including absent, empty, wrong-length, and wrong-content values), the Authenticator SHALL reject the request with HTTP 401 and no script SHALL be executed.

**Validates: Requirements 2.2, 2.3**

### Property 2: Identifier validation

*For any* Script_Identifier that is empty, longer than 128 characters, or contains a character outside `[A-Za-z0-9_-]`, the API SHALL respond with HTTP 400 and the Executor SHALL NOT run any script.

**Validates: Requirements 3.3**

### Property 3: Absent identifiers never execute

*For any* Script_Identifier that is not present in the Script_Whitelist, the API SHALL respond with HTTP 400 and the Executor SHALL NOT run any script.

**Validates: Requirements 3.2**

### Property 4: Whitelist path confinement

*For any* whitelist entry whose resolved real path is not an existing regular file or resolves through a symbolic link to a location different from its configured absolute path, the API SHALL respond with HTTP 404 and the Executor SHALL NOT run any script.

**Validates: Requirements 3.4**

### Property 5: Safe discrete invocation (no shell)

*For any* list of validated argument tokens, the Executor SHALL invoke the mapped script with those tokens as discrete argv entries, without passing client input through a shell command line, so the tokens forwarded equal the tokens supplied.

**Validates: Requirements 3.6, 4.5**

### Property 6: Argument acceptance preserves tokens

*For any* list of at most 256 tokens where each token has length 1–4096 and contains only Safe_Character_Set characters, the Argument_Validator SHALL accept the list and return tokens identical to the input.

**Validates: Requirements 4.1**

### Property 7: Unsafe arguments are rejected

*For any* argument list that is not a list of strings, contains more than 256 elements, contains a token longer than 4096 characters, contains an empty token, or contains any token with a character outside `^[\w@%+=:,./-]+$`, the API SHALL respond with HTTP 400 identifying the offending input and the Executor SHALL NOT run any script.

**Validates: Requirements 4.2, 4.3, 4.6**

### Property 8: Output cap invariant

*For any* script producing output of any size, the retained standard output and retained standard error each SHALL be at most Max_Output_Bytes bytes, and exceeding the limit SHALL NOT fail the execution.

**Validates: Requirements 5.4, 5.5**

### Property 9: Timeout invariant

*For any* script whose runtime would exceed Exec_Timeout, the Executor SHALL terminate the process, set the timed-out indicator to true, and return the output captured before termination.

**Validates: Requirements 5.2**

### Property 10: Result shape and status mapping

*For any* completed execution, the response SHALL include exit code, terminating signal, timed-out indicator, and a duration in whole milliseconds greater than or equal to 0; the status SHALL be 200 when the exit code is 0 and the timed-out indicator is false, and 500 when the exit code is non-zero or the timed-out indicator is true.

**Validates: Requirements 5.6, 5.7, 5.8**

### Property 11: Trace-id consistency

*For any* request, the API SHALL assign exactly one Trace_Id and the value in the `x-trace-id` response header SHALL equal the Trace_Id in the JSON response body.

**Validates: Requirements 6.1, 6.3**

### Property 12: Trace-id source selection

*For any* incoming `x-trace-id` header value matching `^[\w-]{1,64}$`, the API SHALL use that value as the Trace_Id; otherwise the API SHALL generate a Trace_Id matching `^[\w-]{1,64}$`.

**Validates: Requirements 6.2**

### Property 13: Application log format

*For any* application log line the API emits, the line SHALL contain an ISO-8601 UTC timestamp, a severity level that is exactly one of INFO, WARN, or ERROR, and the Trace_Id of the associated request.

**Validates: Requirements 6.4**

### Property 14: Execution log record completeness

*For any* completed execution regardless of outcome, the API SHALL write an Execution_Log file whose name contains the Trace_Id and whose content records the command, arguments, exit code, terminating signal, timed-out indicator, duration in milliseconds, captured standard output, and captured standard error.

**Validates: Requirements 6.5**

### Property 15: Configuration validation rejects invalid integers and ranges

*For any* integer-valued environment variable given a value that cannot be parsed as an integer or falls outside its permitted range (PORT 1–65535, Exec_Timeout ≥ 1000 ms, Max_Output_Bytes ≥ 1 byte), the API SHALL abort startup with a non-zero exit status and emit a startup log message that names the offending variable.

**Validates: Requirements 7.4, 7.5**
