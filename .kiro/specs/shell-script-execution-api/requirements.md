# Requirements Document

## Introduction

The Shell Script Execution API is a REST service, built with Python and FastAPI, that allows authorized clients to invoke a set of pre-configured shell scripts on a Linux server. The service exists so that operational scripts (installs, maintenance tasks, and similar automation) can be triggered remotely over HTTP without granting arbitrary command execution. Only scripts present in a configured whitelist may be run, and script arguments are restricted to a safe character set to prevent command injection.

The design mirrors proven patterns from the existing TypeScript executor service in this workspace: API-key authentication via an `x-api-key` header with constant-time comparison, a whitelist plus argument validation, per-execution timeout and output-size safeguards, environment-based configuration, structured application logging together with per-execution log files keyed by a trace id, Docker Compose deployment, and an unauthenticated health probe. The service also publishes an OpenAPI/Swagger specification and ships with unit tests.

## Glossary

- **API**: The Shell Script Execution API service defined by this document.
- **Client**: Any HTTP caller that sends requests to the API.
- **Script_Whitelist**: The configured set of script identifiers that the API is permitted to execute. Each entry maps a client-supplied script identifier to an absolute path of an executable shell script on the server.
- **Script_Identifier**: A short name supplied by the Client to select which whitelisted script to execute.
- **Executor**: The API component that runs a whitelisted script as a child process and captures its result.
- **Authenticator**: The API component that validates the `x-api-key` header.
- **Argument_Validator**: The API component that validates client-supplied script arguments against the safe character set.
- **Safe_Character_Set**: The set of characters permitted in a single argument token, defined as word characters and the symbols `@ % + = : , . / -` (matching the regular expression `^[\w@%+=:,./-]+$`).
- **Trace_Id**: A unique identifier attached to each request that correlates application log lines, the execution log file, and the response for a single processing flow.
- **Execution_Log**: A per-execution file written to disk that records the full result of one script execution, named using the Trace_Id.
- **Exec_Timeout**: The configured maximum wall-clock duration, in milliseconds, that a single script execution may run before the Executor terminates it.
- **Max_Output_Bytes**: The configured maximum number of bytes of standard output and of standard error retained and returned in the response.
- **Health_Endpoint**: The unauthenticated `GET /health` endpoint.
- **Execute_Endpoint**: The authenticated `POST /execute` endpoint that runs a whitelisted script.
- **Execution_Target_Identifier**: A non-secret label identifying the configured execution target that the API reports in the Health_Endpoint response, excluding all secret values.

## Requirements

### Requirement 1: Health Check

**User Story:** As an orchestrator operator, I want an unauthenticated health endpoint, so that I can probe service liveness from Docker and other monitors without credentials.

#### Acceptance Criteria

1. WHEN a Client sends a `GET /health` request, THE API SHALL respond within 1000 milliseconds with HTTP status 200 and a JSON body containing the field `status` set to `"ok"`.
2. WHEN a Client sends a `GET /health` request without the `x-api-key` header or with an invalid `x-api-key` value, THE API SHALL respond with HTTP status 200 and SHALL NOT reject the request for missing or invalid authentication.
3. WHEN a Client sends a `GET /health` request, THE API SHALL include in the JSON body a non-empty identifier of the configured execution target, and THE API SHALL exclude from the response body all secret values, including any API key and any credential or token used to reach the execution target.
4. IF the process is running but a dependency required to report the execution target identifier is unavailable, THEN THE API SHALL respond with HTTP status 200, SHALL set the field `status` to `"ok"`, and SHALL omit or set to null the execution target identifier field without exposing internal error detail.

### Requirement 2: API-Key Authentication

**User Story:** As a service owner, I want API-key authentication on execution endpoints, so that only authorized clients can run scripts.

#### Acceptance Criteria

1. WHERE the configured API key is a non-empty value, WHEN a Client sends a request to the Execute_Endpoint with an `x-api-key` header whose value is byte-for-byte equal to the configured API key, THE Authenticator SHALL permit the request to proceed to script execution.
2. WHERE the configured API key is a non-empty value, IF a Client sends a request to the Execute_Endpoint with an `x-api-key` header that is absent, empty, or not byte-for-byte equal to the configured API key, THEN THE API SHALL reject the request with HTTP status 401, SHALL return a JSON body containing an error field indicating that the API key is invalid or missing, and SHALL NOT execute any script.
3. THE Authenticator SHALL compare the provided key against the configured key using a constant-time comparison, and SHALL treat any length mismatch between the provided value and the configured key as a non-match.
4. WHERE the configured API key is an empty value, THE Authenticator SHALL permit requests to the Execute_Endpoint to proceed without evaluating the `x-api-key` header.
5. WHERE the configured API key is a non-empty value, IF a Client sends more than one `x-api-key` header on a single request, THEN THE API SHALL reject the request with HTTP status 401, SHALL return a JSON body containing an error field indicating that the API key is invalid or missing, and SHALL NOT execute any script.

### Requirement 3: Script Whitelisting

**User Story:** As a security-conscious operator, I want only whitelisted scripts to be executable, so that clients cannot run arbitrary commands.

#### Acceptance Criteria

1. WHEN a Client requests execution of a Script_Identifier that is present in the Script_Whitelist, THE API SHALL execute the mapped script.
2. IF a Client requests execution of a Script_Identifier that is absent from the Script_Whitelist, THEN THE API SHALL respond with HTTP status 400 and a JSON error message, and THE Executor SHALL NOT run any script.
3. IF a submitted Script_Identifier is empty, exceeds 128 characters, or contains characters outside the set of ASCII letters, digits, hyphen, and underscore, THEN THE API SHALL respond with HTTP status 400 and a JSON error message indicating an invalid identifier, and THE Executor SHALL NOT run any script.
4. IF a whitelisted Script_Identifier maps to a path that does not resolve to an existing regular file, or resolves through a symbolic link to a location outside its configured absolute path, THEN THE API SHALL respond with HTTP status 404 and a JSON error message, and THE Executor SHALL NOT run any script.
5. IF a whitelisted Script_Identifier maps to an existing regular file that the API process lacks permission to execute, THEN THE API SHALL respond with HTTP status 500 and a JSON error message indicating the script cannot be executed, and THE Executor SHALL NOT run any script.
6. THE Executor SHALL invoke the mapped script directly as a child process without evaluating client input through a shell command line.

### Requirement 4: Argument Validation

**User Story:** As a security-conscious operator, I want script arguments validated against a safe character set, so that command injection is prevented.

#### Acceptance Criteria

1. WHEN a Client supplies an `args` field, THE Argument_Validator SHALL require `args` to be a list of no more than 256 strings, each string containing between 1 and 4096 characters.
2. IF the `args` field is present and is not a list of strings, or contains more than 256 elements, or contains any string longer than 4096 characters, THEN THE API SHALL respond with HTTP status 400 and a JSON error message indicating the argument list is invalid, and THE Executor SHALL NOT run any script.
3. IF any argument token contains a character outside the Safe_Character_Set (defined by the regular expression `^[\w@%+=:,./-]+$`), THEN THE API SHALL respond with HTTP status 400 and a JSON error message identifying the rejected token, and THE Executor SHALL NOT run any script.
4. WHEN the `args` field is omitted, THE Argument_Validator SHALL treat the argument list as empty.
5. WHEN all argument tokens conform to the Safe_Character_Set, THE Argument_Validator SHALL forward the validated tokens to the Executor as discrete arguments.
6. IF any argument token is an empty string, THEN THE API SHALL respond with HTTP status 400 and a JSON error message identifying the rejected token, and THE Executor SHALL NOT run any script.

### Requirement 5: Execution Safeguards

**User Story:** As an operator, I want per-execution timeout and output limits, so that a single script cannot exhaust server resources.

#### Acceptance Criteria

1. THE Executor SHALL enforce a per-execution timeout, Exec_Timeout, expressed in milliseconds, with a configurable value of at least 1000 ms and a default of 60000 ms.
2. IF a script execution runs longer than Exec_Timeout, THEN THE Executor SHALL terminate the script process, mark the execution as timed out, and return the standard output and standard error captured before termination.
3. THE Executor SHALL enforce an output limit, Max_Output_Bytes, expressed in bytes, with a configurable value of at least 1024 bytes and a default of 1048576 bytes.
4. WHEN standard output exceeds Max_Output_Bytes, THE Executor SHALL retain only the first Max_Output_Bytes bytes of standard output and discard the remainder without failing the execution.
5. WHEN standard error exceeds Max_Output_Bytes, THE Executor SHALL retain only the first Max_Output_Bytes bytes of standard error and discard the remainder without failing the execution.
6. WHEN a script execution completes, THE API SHALL include in the response body the exit code, the terminating signal, the timed-out indicator, and the execution duration in whole milliseconds greater than or equal to 0.
7. WHEN a script execution exits with exit code 0 and the timed-out indicator is false, THE API SHALL respond with HTTP status 200 and include the execution result in the response body.
8. IF a script execution exits with a non-zero exit code or the timed-out indicator is true, THEN THE API SHALL respond with HTTP status 500 and include the execution result in the response body.
9. IF a script process cannot be started or terminates without an exit code, THEN THE API SHALL respond with HTTP status 500, set the exit code to null in the response body, and include an error indication describing the failure.

### Requirement 6: Structured Logging and Tracing

**User Story:** As an operator investigating an execution, I want structured logs and a per-execution record keyed by a trace id, so that I can follow one flow end to end.

#### Acceptance Criteria

1. WHEN the API receives a request, THE API SHALL assign exactly one Trace_Id to that request before any other processing.
2. WHEN the `x-trace-id` header of an incoming request contains a value matching the pattern `^[\w-]{1,64}$`, THE API SHALL use that value as the Trace_Id; otherwise THE API SHALL generate a new Trace_Id consisting of 1 to 64 characters from the set `[\w-]`.
3. WHEN the API produces any response, whether success or error, THE API SHALL include the request's Trace_Id both in the `x-trace-id` response header and as a field in the JSON response body.
4. WHEN the API emits an application log line, THE API SHALL include in that line an ISO-8601 UTC timestamp, a severity level that is exactly one of INFO, WARN, or ERROR, and the Trace_Id of the associated request.
5. WHEN a script execution completes, regardless of whether it succeeded, returned a non-zero exit code, was terminated by a signal, or timed out, THE API SHALL write an Execution_Log file whose name contains the Trace_Id and whose content records the command, the arguments, the exit code, the terminating signal, the timed-out indicator, the duration in milliseconds, the captured standard output, and the captured standard error.
6. IF writing the Execution_Log file fails, THEN THE API SHALL emit an application log line at severity ERROR that includes the Trace_Id and indicates the execution-log write failure, and THE API SHALL still return the execution result response to the caller.

### Requirement 7: Environment-Based Configuration

**User Story:** As a deployer, I want all settings supplied through environment variables, so that the same image runs in any environment.

#### Acceptance Criteria

1. THE API SHALL load the listening port, bind host, API key, Exec_Timeout, Max_Output_Bytes, script whitelist configuration, working directory, data directory, and log directory from environment variables during startup.
2. WHERE an optional environment variable is unset or empty, THE API SHALL apply a documented default value for that variable and continue startup.
3. IF a required environment variable is unset or empty and has no default, THEN THE API SHALL abort startup with a non-zero exit status and emit a startup log message that identifies the missing variable by name.
4. IF an environment variable expected to hold an integer contains a value that cannot be parsed as an integer, or that falls outside its permitted range, THEN THE API SHALL abort startup with a non-zero exit status and emit a startup log message that identifies the offending variable by name.
5. THE API SHALL treat the listening port as valid only within the range 1 to 65535 inclusive, Exec_Timeout as valid only when greater than or equal to 1 second, and Max_Output_Bytes as valid only when greater than or equal to 1 byte.

### Requirement 8: OpenAPI Documentation

**User Story:** As an API consumer, I want an OpenAPI/Swagger specification, so that I can discover and test the endpoints.

#### Acceptance Criteria

1. THE API SHALL publish an OpenAPI specification that describes the Health_Endpoint and the Execute_Endpoint, including for each endpoint the HTTP method, request parameters, request body schema, and response schema for both success and error outcomes.
2. WHEN a client requests the published OpenAPI specification, THE API SHALL return the specification within 2 seconds.
3. THE API SHALL serve an interactive Swagger user interface for the published OpenAPI specification that allows a consumer to invoke the Health_Endpoint and the Execute_Endpoint.
4. WHEN a client requests the Swagger user interface, THE API SHALL return the interface within 2 seconds.
5. THE OpenAPI specification SHALL document the `x-api-key` header as a required security scheme applied to the Execute_Endpoint.
6. THE OpenAPI specification SHALL indicate that the Health_Endpoint does not require the `x-api-key` header.
7. IF a client requests the OpenAPI specification or the Swagger user interface and the requested resource cannot be produced, THEN THE API SHALL return an error response containing an error indication describing the failure, while preserving availability of the documented endpoints.

### Requirement 9: Docker Deployment

**User Story:** As a deployer, I want to run the API through Docker Compose with a health probe, so that deployment is repeatable.

#### Acceptance Criteria

1. THE API SHALL provide a Docker Compose configuration that starts the service and applies a restart policy that restarts the container on failure or unexpected exit.
2. THE Docker Compose configuration SHALL define a health check that probes the Health_Endpoint without supplying the `x-api-key` header, using a probe interval no greater than 30 seconds, a probe timeout no greater than 10 seconds, and no fewer than 3 consecutive failed probes before the container is marked unhealthy.
3. WHEN the Health_Endpoint returns a successful response within the configured probe timeout, THE Docker Compose configuration SHALL classify the container as healthy.
4. IF the health check records the configured number of consecutive failed probes, THEN THE Docker Compose configuration SHALL classify the container as unhealthy.
5. THE Docker Compose configuration SHALL mount the data directory and the log directory as volumes so that Execution_Log files persist outside the container.
6. WHEN the container is restarted or recreated, THE Docker Compose configuration SHALL retain all previously written Execution_Log files through the mounted volumes.

### Requirement 10: Unit Tests

**User Story:** As a maintainer, I want unit tests, so that the core behaviors remain verifiable.

#### Acceptance Criteria

1. WHEN a test issues a GET request to the Health_Endpoint, THE test suite SHALL assert the response has HTTP status 200 and a body with `status` equal to `"ok"`.
2. WHEN a test invokes the Authenticator with a request whose `x-api-key` header exactly matches the configured API key, THE test suite SHALL assert the request is accepted and forwarded to the next handler.
3. IF a test invokes the Authenticator with a request whose `x-api-key` header is missing or does not exactly match the configured API key, THEN THE test suite SHALL assert the response has HTTP status 401 and a body containing an error indication describing the unauthorized access, and asserts no protected handler is invoked.
4. WHEN a test invokes the Argument_Validator with an `args` array whose every token contains only characters within the Safe_Character_Set (1 to 4096 characters per token), THE test suite SHALL assert the validator returns a success result whose returned tokens equal the input tokens.
5. IF a test invokes the Argument_Validator with an `args` value that is not an array of strings, or with any token containing one or more characters outside the Safe_Character_Set, THEN THE test suite SHALL assert the validator returns a rejection result carrying an error indication identifying the invalid input, and asserts the associated request would be answered with HTTP status 400.
6. IF a test issues a request for a Script_Identifier that is absent from the Script_Whitelist, THEN THE test suite SHALL assert the response has HTTP status 400 and a body containing an error indication that the requested script is not permitted.
