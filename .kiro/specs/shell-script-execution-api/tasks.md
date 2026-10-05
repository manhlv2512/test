# Implementation Plan: Shell Script Execution API

## Overview

This plan builds the FastAPI service incrementally, starting from project scaffolding and configuration, then the pure/leaf components (models, argument validation, whitelist confinement, executor, logger, trace middleware, authenticator), and finally wiring them into the API layer with OpenAPI security metadata. Deployment artifacts (Dockerfile, docker-compose.yml) and the pytest suite — example tests plus property-based tests for all 15 correctness properties — complete the plan. Each task builds on the previous ones and ends with integration wiring so no code is left orphaned.

Language: Python 3.11+ with FastAPI, Uvicorn, Pydantic v2, and pytest (Hypothesis for property-based tests).

## Tasks

- [ ] 1. Scaffold project structure and dependencies
  - [ ] 1.1 Create package layout and dependencies
    - Create `requirements.txt` pinning FastAPI, Uvicorn, Pydantic v2, pytest, and Hypothesis
    - Create the `app/` package with `__init__.py` and empty module files (`config.py`, `models.py`, `args.py`, `whitelist.py`, `executor.py`, `logger.py`, `trace.py`, `auth.py`, `main.py`)
    - Create the `tests/` package with `__init__.py` and a `conftest.py` placeholder
    - _Requirements: 7.1_

- [ ] 2. Implement environment-based configuration
  - [ ] 2.1 Implement Config with env parsing and fail-fast validation
    - In `app/config.py`, implement `Config.load(env)` reading `PORT`, `HOST`, `API_KEY`, `EXEC_TIMEOUT_MS`, `MAX_OUTPUT_BYTES`, `SCRIPTS`, `WORK_DIR`, `DATA_DIR`, `LOG_DIR`
    - Apply documented defaults for unset/empty optional variables; raise `ConfigError` naming the offending variable for non-integer or out-of-range values (PORT 1–65535, `EXEC_TIMEOUT_MS` ≥ 1000, `MAX_OUTPUT_BYTES` ≥ 1024)
    - Parse the `SCRIPTS` whitelist config (`identifier=absolute_path` semicolon-separated), validating identifiers against `^[A-Za-z0-9_-]{1,128}$` and requiring absolute paths, into a `dict[str, str]`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [ ]* 2.2 Write property test for configuration validation
    - **Property 15: Configuration validation rejects invalid integers and ranges**
    - **Validates: Requirements 7.4, 7.5**

  - [ ]* 2.3 Write unit tests for Config defaults and required-variable failures
    - Assert documented defaults are applied when optional vars are unset (7.2)
    - Assert a missing required variable aborts with a message naming the variable (7.3)
    - Assert boundary values for `EXEC_TIMEOUT_MS`, `MAX_OUTPUT_BYTES`, and `PORT` (5.1, 5.3, 7.5)
    - _Requirements: 7.2, 7.3, 7.5_

- [ ] 3. Define Pydantic data models
  - In `app/models.py`, define `ExecuteRequest`, `ExecuteResponse`, `HealthResponse`, and `ErrorResponse` per the design, with per-status response models for OpenAPI documentation
  - _Requirements: 3.3, 4.1, 5.6, 8.1_

- [ ] 4. Implement argument validation
  - [ ] 4.1 Implement ArgumentValidator
    - In `app/args.py`, implement `validate_args(args)` enforcing: list-of-strings shape, ≤ 256 elements, per-token length 1–4096, and `SAFE_ARG = ^[\w@%+=:,./-]+$`; return `[]` when `args` is `None`
    - Raise `ArgError` (→ HTTP 400) identifying the offending token/reason; return validated tokens unchanged
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [ ]* 4.2 Write property test for argument acceptance
    - **Property 6: Argument acceptance preserves tokens**
    - **Validates: Requirements 4.1**

  - [ ]* 4.3 Write property test for unsafe argument rejection
    - **Property 7: Unsafe arguments are rejected**
    - **Validates: Requirements 4.2, 4.3, 4.6**

  - [ ]* 4.4 Write unit tests for ArgumentValidator edge cases
    - Assert all-safe-token list returns identical tokens (10.4)
    - Assert non-list / unsafe-token / empty-token inputs are rejected → 400 (10.5, 4.6)
    - _Requirements: 10.4, 10.5_

- [ ] 5. Implement script whitelist resolution and confinement
  - [ ] 5.1 Implement ScriptWhitelist.resolve
    - In `app/whitelist.py`, implement identifier validation (`^[A-Za-z0-9_-]{1,128}$`), whitelist membership, symlink-resolving confinement via `os.path.realpath` equality to the configured path being an existing regular file, and executability via `os.access(path, os.X_OK)`
    - Raise `InvalidIdentifier` (400), `NotWhitelisted` (400), `NotFound` (404), `NotExecutable` (500) per design
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ]* 5.2 Write property test for identifier validation
    - **Property 2: Identifier validation**
    - **Validates: Requirements 3.3**

  - [ ]* 5.3 Write property test for absent-identifier rejection
    - **Property 3: Absent identifiers never execute**
    - **Validates: Requirements 3.2**

  - [ ]* 5.4 Write property test for whitelist path confinement
    - **Property 4: Whitelist path confinement**
    - **Validates: Requirements 3.4**

  - [ ]* 5.5 Write unit tests for non-executable and absent identifiers
    - Assert a non-executable file yields 500 (3.5)
    - Assert an absent identifier yields 400 with a not-permitted error (10.6)
    - _Requirements: 3.5, 10.6_

- [ ] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Implement the Executor
  - [ ] 7.1 Implement Executor.run with timeout and output capping
    - In `app/executor.py`, define `ExecuteResult` and implement `run(script_path, args, trace_id)` using `subprocess.Popen([script_path, *args], shell=False, cwd=WORK_DIR, start_new_session=True)`
    - Enforce `EXEC_TIMEOUT_MS` by killing the process group and setting `timed_out=True`; cap retained stdout/stderr at `MAX_OUTPUT_BYTES` each without failing; compute `duration_ms` from a monotonic clock clamped ≥ 0; on spawn failure set `exit_code=None` with an error indication
    - _Requirements: 3.6, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.9_

  - [ ]* 7.2 Write property test for safe discrete invocation
    - **Property 5: Safe discrete invocation (no shell)**
    - **Validates: Requirements 3.6, 4.5**

  - [ ]* 7.3 Write property test for output cap invariant
    - **Property 8: Output cap invariant**
    - **Validates: Requirements 5.4, 5.5**

  - [ ]* 7.4 Write property test for timeout invariant
    - **Property 9: Timeout invariant**
    - **Validates: Requirements 5.2**

  - [ ]* 7.5 Write unit test for spawn failure
    - Assert a non-startable process yields `exit_code=None` with an error indication (5.9)
    - _Requirements: 5.9_

- [ ] 8. Implement structured logging and per-execution records
  - [ ] 8.1 Implement Logger
    - In `app/logger.py`, implement `info`/`warn`/`error` emitting `<ISO-8601 UTC> <LEVEL> [<trace_id>] <message>` and `save_execution(trace_id, result)` writing `<log_dir>/executions/<iso-ts>-<trace_id>.log` with command, args, exit code, signal, timed-out, duration, stdout, stderr; on write failure emit an ERROR line and return
    - _Requirements: 6.4, 6.5, 6.6_

  - [ ]* 8.2 Write property test for application log format
    - **Property 13: Application log format**
    - **Validates: Requirements 6.4**

  - [ ]* 8.3 Write property test for execution log record completeness
    - **Property 14: Execution log record completeness**
    - **Validates: Requirements 6.5**

  - [ ]* 8.4 Write unit test for execution-log write failure
    - Assert a write failure emits an ERROR line and still returns the result (6.6)
    - _Requirements: 6.6_

- [ ] 9. Implement trace-id middleware
  - [ ] 9.1 Implement TraceMiddleware
    - In `app/trace.py`, implement middleware that reuses a valid `x-trace-id` (`^[\w-]{1,64}$`) or generates one via `generate_trace_id()`, stores it on `request.state`, and echoes it in the `x-trace-id` response header
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ]* 9.2 Write property test for trace-id source selection
    - **Property 12: Trace-id source selection**
    - **Validates: Requirements 6.2**

- [ ] 10. Implement the Authenticator
  - [ ] 10.1 Implement require_api_key dependency
    - In `app/auth.py`, implement the FastAPI dependency: bypass when configured key is empty; reject absent/duplicate `x-api-key` with 401; compare with `secrets.compare_digest`; raise `HTTPException(401)` with an error body before the handler runs
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ]* 10.2 Write property test for non-matching API key rejection
    - **Property 1: Non-matching API keys are rejected**
    - **Validates: Requirements 2.2, 2.3**

  - [ ]* 10.3 Write unit tests for Authenticator accept/reject
    - Assert exactly-matching key forwards to the handler (10.2)
    - Assert missing/mismatched key yields 401 with an error body and no handler invocation (10.3)
    - Assert duplicate `x-api-key` header yields 401 (2.5)
    - _Requirements: 10.2, 10.3, 2.5_

- [ ] 11. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 12. Wire the API layer and OpenAPI security
  - [ ] 12.1 Implement FastAPI app, routes, and error handling
    - In `app/main.py`, build the app: register `TraceMiddleware`, implement `GET /health` (no auth, returns `status`/`target`/`traceId`, `target=null` when unavailable) and `POST /execute` (depends on `require_api_key`, validates body via ArgumentValidator, resolves ScriptWhitelist, runs Executor, saves execution log, maps result to 200/500)
    - Add centralised exception handlers mapping domain errors to statuses with `error` + `traceId` bodies and no leaked internals
    - _Requirements: 1.1, 1.3, 1.4, 5.7, 5.8, 6.3_

  - [ ] 12.2 Declare and apply the x-api-key OpenAPI security scheme
    - Declare an `APIKeyHeader` scheme named `x-api-key`, apply it to `/execute`, and mark `/health` as requiring no auth; ensure `/openapi.json` and Swagger UI at `/docs` document both endpoints and success/error schemas
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

  - [ ]* 12.3 Write property test for trace-id consistency
    - **Property 11: Trace-id consistency**
    - **Validates: Requirements 6.1, 6.3**

  - [ ]* 12.4 Write property test for result shape and status mapping
    - **Property 10: Result shape and status mapping**
    - **Validates: Requirements 5.6, 5.7, 5.8**

  - [ ]* 12.5 Write integration tests for the endpoints and OpenAPI
    - Assert `GET /health` → 200 with `status == "ok"`, including with no/invalid key (10.1, 1.2)
    - Assert `POST /execute` with an absent identifier → 400 not-permitted (10.6)
    - Assert `/openapi.json` documents both endpoints, the `x-api-key` scheme on `/execute`, and no auth on `/health` (8.1, 8.5, 8.6)
    - _Requirements: 10.1, 1.2, 10.6, 8.1, 8.5, 8.6_

- [ ] 13. Create Docker deployment artifacts
  - [ ] 13.1 Write the Dockerfile
    - Python 3.11 slim base, install `requirements.txt`, copy `app/`, run `uvicorn app.main:app --host $HOST --port $PORT`; include an in-image `/health` probe helper
    - _Requirements: 9.1_

  - [ ] 13.2 Write docker-compose.yml
    - Define the service with `restart: on-failure` (or `unless-stopped`), a healthcheck probing `GET /health` without `x-api-key` (`interval: 30s`, `timeout: 10s`, `retries: 3`), and volume mounts for `DATA_DIR` and `LOG_DIR`
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

- [ ] 14. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional (tests) and can be skipped for a faster MVP; core implementation tasks are never optional.
- Each task references specific requirements for traceability; property-test tasks reference their property number and validated requirements.
- Property tests use Hypothesis with a minimum of 100 iterations and a controllable helper script / in-process fakes to keep iterations cheap.
- Docker classification criteria (9.3, 9.4, 9.6) are exercised via the compose healthcheck/volume config rather than property tests.
- Checkpoints ensure incremental validation at natural breaks.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1", "3.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "4.1", "5.1", "8.1", "9.1"] },
    { "id": 3, "tasks": ["4.2", "4.3", "4.4", "5.2", "5.3", "5.4", "5.5", "7.1", "8.2", "8.3", "8.4", "9.2", "10.1"] },
    { "id": 4, "tasks": ["7.2", "7.3", "7.4", "7.5", "10.2", "10.3", "12.1"] },
    { "id": 5, "tasks": ["12.2", "12.3", "12.4", "12.5", "13.1"] },
    { "id": 6, "tasks": ["13.2"] }
  ]
}
```
