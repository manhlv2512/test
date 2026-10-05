# Shell Script Execution API

A Python REST API for executing predefined server-side actions. Each action is explicitly whitelisted in `config.yaml`; its executable path can be overridden through environment variables.

## Technology Stack

- Python 3.12+
- FastAPI
- Uvicorn
- Pydantic
- Loguru
- PyYAML
- Docker

## Project Structure

```text
shell-api/
├── app/
│   ├── main.py                 # FastAPI entrypoint
│   ├── routes/
│   │   └── scripts.py          # Generic and named action endpoints
│   ├── services/
│   │   └── executor.py         # Runs configured executables safely
│   ├── models/
│   │   └── request_models.py   # Pydantic request/response models
│   ├── config/
│   │   └── settings.py         # Loads config.yaml + env overrides
│   └── utils/
│       └── logger.py           # Loguru setup
├── scripts/
│   ├── deploy.sh
│   ├── undeploy.sh
│   ├── restart.sh
│   └── backup.sh
├── .env.example
├── config.yaml
├── requirements.txt
├── Dockerfile
└── README.md
```

## Configuration

The `scripts` list in `config.yaml` defines the allowed action names and fallback file paths. Environment variables may override paths, but cannot introduce an action that is not listed here.

```yaml
scripts_dir: "scripts"
default_timeout: 60
max_timeout: 600
api_key: null

scripts:
  - name: "deploy"
    file: "deploy.sh"
    description: "Deploy the application"
    allow_args: true
```

### Environment variables

| Variable | Overrides |
|----------|-----------|
| `X_API_KEY` | `api_key` (preferred; clients send it as `X-API-Key`) |
| `SHELL_API_KEY` | Backward-compatible alias for `X_API_KEY` |
| `SHELL_API_SCRIPTS_DIR` | Base `scripts_dir` |
| `SHELL_API_SCRIPT_<ACTION>` | `file` for a configured action |
| `SHELL_API_PORT` | `app.port` |
| `SHELL_API_LOG_LEVEL` | `logging.level` |
| `SHELL_API_CONFIG` | Path to the YAML config file |

The action name is uppercased and every non-alphanumeric character becomes `_`. For example, `db-reset` uses `SHELL_API_SCRIPT_DB_RESET`.

```dotenv
X_API_KEY=secret123
SHELL_API_SCRIPTS_DIR=/opt/actions
SHELL_API_SCRIPT_DEPLOY=deploy.sh
SHELL_API_SCRIPT_UNDEPLOY=undeploy.sh
SHELL_API_SCRIPT_RESTART=restart.sh
SHELL_API_SCRIPT_BACKUP=backup.sh
```

`SHELL_API_SCRIPT_DEPLOY=deploy.sh` resolves to `/opt/actions/deploy.sh`. An absolute value is also accepted if it remains inside `SHELL_API_SCRIPTS_DIR`.

## Running Locally

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --env-file .env --host 0.0.0.0 --port 8000
```

Interactive API docs: `http://localhost:8000/docs`.

## Running with Docker

Use the built-in example executables:

```bash
docker build -t shell-api .
docker run --rm -p 8000:8000 -e X_API_KEY=secret123 shell-api
```

Mount external executables and override their paths:

```bash
docker run --rm -p 8000:8000 \
  -e X_API_KEY=secret123 \
  -e SHELL_API_SCRIPTS_DIR=/actions \
  -e SHELL_API_SCRIPT_DEPLOY=deploy.sh \
  -e SHELL_API_SCRIPT_UNDEPLOY=undeploy.sh \
  -e SHELL_API_SCRIPT_RESTART=restart.sh \
  -v /opt/actions:/actions:ro \
  shell-api
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Service metadata |
| GET | `/health` | Health check |
| GET | `/scripts` | List configured actions |
| GET | `/scripts/{name}` | Get one configured action's metadata |
| POST | `/scripts/deploy` | Run configured `deploy` action |
| POST | `/scripts/undeploy` | Run configured `undeploy` action |
| POST | `/scripts/restart` | Run configured `restart` action |
| POST | `/scripts/execute` | Run an executable path from the request body |

The three named action endpoints accept an optional body containing CLI arguments and timeout:

```json
{
  "args": ["staging"],
  "timeout": 120
}
```

The generic path endpoint accepts:

```json
{
  "path": "tools/custom-action",
  "name": "custom-deploy",
  "payload": {
    "service": "api",
    "environment": "staging"
  },
  "args": ["--force"],
  "timeout": 120
}
```

- `path` is required and must resolve inside `scripts_dir`.
- `name` is an optional label used in logs and the response.
- `payload` is optional structured log metadata; it is not sent to the process.
- `args` are the actual process arguments.
- `/scripts/execute` always requires a configured API key and the matching `X-API-Key` header.

### Curl examples

```bash
export API_KEY=secret123

# Deploy using the configured action path
curl -sS -X POST http://localhost:8000/scripts/deploy \
  -H "X-API-Key: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"args":["staging"],"timeout":120}'

# Undeploy using the configured action path
curl -sS -X POST http://localhost:8000/scripts/undeploy \
  -H "X-API-Key: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"args":["staging"]}'

# Restart (body is optional)
curl -sS -X POST http://localhost:8000/scripts/restart \
  -H "X-API-Key: ${API_KEY}"

# Execute a request-supplied path relative to scripts_dir
curl -sS -X POST http://localhost:8000/scripts/execute \
  -H "X-API-Key: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "path": "backup.sh",
    "name": "manual-backup",
    "payload": {"requested_by": "deployment-service"},
    "args": ["database"],
    "timeout": 120
  }'
```

Example response:

```json
{
  "script": "custom-deploy",
  "success": true,
  "exit_code": 0,
  "stdout": "...",
  "stderr": "",
  "duration_seconds": 2.01,
  "timed_out": false
}
```

## Adding a New Action

1. Place an executable inside `scripts_dir`; scripts should have a valid shebang and execute permission (`chmod +x`). Native binaries are also supported.
2. To expose a named action, add its `name`, fallback `file`, `description`, and `allow_args` to `config.yaml`.
3. Optionally set `SHELL_API_SCRIPT_<ACTION>` to override that action's fallback path.
4. Restart the service so settings are reloaded.

## Security Notes

- Named endpoints only run paths configured for their corresponding action.
- The generic endpoint can select any executable inside `scripts_dir`, but requires API-key authentication.
- Resolved files must stay inside `scripts_dir`; path traversal and symlink escape are rejected.
- Executables are launched with an argv list, never a command string.
- `payload` is written to logs; do not include passwords, tokens, or other secrets.
- Arguments are ignored when a configured action has `allow_args: false`.
- Execution time is capped by `max_timeout`.
