/**
 * Centralized configuration loaded from environment variables.
 * Everything is configured via env so the same bundle/image works anywhere.
 */

function str(name: string, fallback?: string): string {
  const v = process.env[name];
  if (v === undefined || v === "") {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

function int(name: string, fallback: number): number {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  const n = Number.parseInt(v, 10);
  if (Number.isNaN(n)) {
    throw new Error(`Environment variable ${name} must be an integer, got: ${v}`);
  }
  return n;
}

/**
 * Execution mode:
 *  - "local": run the .sh script directly inside the container (DEV / testing).
 *  - "ssh":   run the command on a remote host via SSH, optionally hopping
 *             through a bastion/jump host (UAT / PROD). This lets a
 *             non-privileged container trigger admin.sh / install.py that
 *             must run on the real host, without installing Node on the host.
 */
export type ExecMode = "local" | "ssh";

export interface SshConfig {
  /** Target host in `user@host` form (the machine where admin.sh runs). */
  target: string;
  /** Optional bastion/jump host in `user@host` form. Empty = direct connect. */
  jump: string;
  /** SSH port of the target. */
  port: number;
  /** Path (inside the container) to the private key used for SSH. */
  key: string;
  /**
   * Remote command template executed on the target host.
   * `{{ARGS}}` is replaced with the validated, space-joined API args.
   * Example: `cd /opt/app && ./admin.sh -f /local/install.py {{ARGS}}`
   */
  remoteCommand: string;
  /** Extra `-o Key=Value` ssh options (comma separated). */
  extraOptions: string[];
}

export interface AppConfig {
  /** HTTP port the server listens on. */
  port: number;
  /** Host/interface to bind. */
  host: string;
  /** API key required in the `x-api-key` header. Empty string disables auth. */
  apiKey: string;
  /** How the script/command is executed. */
  execMode: ExecMode;
  /** Absolute path (inside the container) to the .sh script to execute (local mode). */
  scriptPath: string;
  /** Shell used to run the script. */
  shell: string;
  /** Working directory the script runs in. */
  workDir: string;
  /** Shared data directory (mounted volume). */
  dataDir: string;
  /** Log directory (mounted volume). */
  logDir: string;
  /** Max execution time in ms before the script is killed. */
  execTimeoutMs: number;
  /** Max stdout/stderr buffer size returned in the response (bytes). */
  maxOutputBytes: number;
  /** SSH settings (used when execMode === "ssh"). */
  ssh: SshConfig;
}

export function loadConfig(): AppConfig {
  const execMode = str("EXEC_MODE", "local") as ExecMode;
  if (execMode !== "local" && execMode !== "ssh") {
    throw new Error(`EXEC_MODE must be "local" or "ssh", got: ${execMode}`);
  }

  const extraOptionsRaw = str("SSH_EXTRA_OPTIONS", "");
  const extraOptions = extraOptionsRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const cfg: AppConfig = {
    port: int("PORT", 3000),
    host: str("HOST", "0.0.0.0"),
    apiKey: str("API_KEY", ""),
    execMode,
    scriptPath: str("SCRIPT_PATH", "/scripts/execute.sh"),
    shell: str("SHELL_BIN", "/bin/bash"),
    workDir: str("WORK_DIR", "/scripts"),
    dataDir: str("DATA_DIR", "/data"),
    logDir: str("LOG_DIR", "/logs"),
    execTimeoutMs: int("EXEC_TIMEOUT_MS", 60000),
    maxOutputBytes: int("MAX_OUTPUT_BYTES", 1024 * 1024),
    ssh: {
      target: str("SSH_HOST", ""),
      jump: str("SSH_JUMP", ""),
      port: int("SSH_PORT", 22),
      key: str("SSH_KEY", "/root/.ssh/id_rsa"),
      remoteCommand: str("SSH_REMOTE_COMMAND", ""),
      extraOptions,
    },
  };

  if (cfg.execMode === "ssh") {
    if (!cfg.ssh.target) throw new Error("SSH_HOST is required when EXEC_MODE=ssh");
    if (!cfg.ssh.remoteCommand) throw new Error("SSH_REMOTE_COMMAND is required when EXEC_MODE=ssh");
  }

  return cfg;
}
