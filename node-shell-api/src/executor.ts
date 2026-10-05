import { spawn } from "node:child_process";
import fs from "node:fs";
import crypto from "node:crypto";
import type { AppConfig } from "./config";

export interface ExecuteOptions {
  /** Extra arguments forwarded to the script / remote command. */
  args?: string[];
  /** Extra environment variables merged into the child process env (local mode). */
  env?: Record<string, string>;
  /**
   * Trace id for this processing flow. If provided it is used as the result
   * id (so logs and the execution file share the same id). A random one is
   * generated otherwise.
   */
  traceId?: string;
}

export interface ExecuteResult {
  id: string;
  mode: "local" | "ssh";
  command: string;
  args: string[];
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  timedOut: boolean;
  stdout: string;
  stderr: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
}

/** Only allow simple, safe argument tokens to avoid shell-injection surprises. */
const SAFE_ARG = /^[\w@%+=:,./-]+$/;

export class ScriptExecutor {
  constructor(private cfg: AppConfig) {}

  validateArgs(args: unknown): { ok: true; args: string[] } | { ok: false; error: string } {
    if (args === undefined) return { ok: true, args: [] };
    if (!Array.isArray(args)) return { ok: false, error: "`args` must be an array of strings" };
    const out: string[] = [];
    for (const a of args) {
      if (typeof a !== "string") return { ok: false, error: "`args` must contain only strings" };
      if (!SAFE_ARG.test(a)) {
        return { ok: false, error: `Argument rejected (invalid characters): ${a}` };
      }
      out.push(a);
    }
    return { ok: true, args: out };
  }

  /** In local mode, verify the script file exists. In ssh mode this is a no-op (true). */
  isReady(): boolean {
    if (this.cfg.execMode === "ssh") return true;
    try {
      return fs.statSync(this.cfg.scriptPath).isFile();
    } catch {
      return false;
    }
  }

  /** Describe the target for /health without leaking secrets. */
  describeTarget(): Record<string, unknown> {
    if (this.cfg.execMode === "ssh") {
      return {
        mode: "ssh",
        target: this.cfg.ssh.target,
        jump: this.cfg.ssh.jump || null,
        port: this.cfg.ssh.port,
      };
    }
    return { mode: "local", scriptPath: this.cfg.scriptPath, scriptExists: this.isReady() };
  }

  /** Build the [command, args[]] pair to spawn, depending on the exec mode. */
  private buildCommand(args: string[]): { cmd: string; argv: string[]; display: string } {
    if (this.cfg.execMode === "ssh") {
      const s = this.cfg.ssh;
      const argv: string[] = [
        "-i",
        s.key,
        "-p",
        String(s.port),
        "-o",
        "StrictHostKeyChecking=accept-new",
        "-o",
        "BatchMode=yes",
        "-o",
        "ConnectTimeout=15",
      ];
      for (const opt of s.extraOptions) {
        argv.push("-o", opt);
      }
      // Route through a bastion/jump host when configured (UAT/PROD).
      if (s.jump) {
        argv.push("-J", s.jump);
      }
      argv.push(s.target);
      // Substitute {{ARGS}} with the space-joined validated args (already safe).
      const remote = s.remoteCommand.replace(/\{\{ARGS\}\}/g, args.join(" ")).trim();
      argv.push(remote);
      return { cmd: "ssh", argv, display: `ssh ${s.jump ? `-J ${s.jump} ` : ""}${s.target} "${remote}"` };
    }

    // local mode
    const argv = [this.cfg.scriptPath, ...args];
    return {
      cmd: this.cfg.shell,
      argv,
      display: `${this.cfg.shell} ${this.cfg.scriptPath} ${args.join(" ")}`.trim(),
    };
  }

  run(opts: ExecuteOptions = {}): Promise<ExecuteResult> {
    const id = opts.traceId ?? crypto.randomBytes(6).toString("hex");
    const args = opts.args ?? [];
    const startedAt = new Date();
    const { cmd, argv, display } = this.buildCommand(args);

    return new Promise((resolve) => {
      const child = spawn(cmd, argv, {
        cwd: this.cfg.execMode === "local" ? this.cfg.workDir : undefined,
        env: {
          ...process.env,
          DATA_DIR: this.cfg.dataDir,
          LOG_DIR: this.cfg.logDir,
          TRACE_ID: id,
          ...(opts.env ?? {}),
        },
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";
      let timedOut = false;
      const limit = this.cfg.maxOutputBytes;

      const append = (buf: string, chunk: Buffer): string =>
        buf.length >= limit ? buf : (buf + chunk.toString()).slice(0, limit);

      child.stdout.on("data", (c: Buffer) => (stdout = append(stdout, c)));
      child.stderr.on("data", (c: Buffer) => (stderr = append(stderr, c)));

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGKILL");
      }, this.cfg.execTimeoutMs);

      const finish = (exitCode: number | null, signal: NodeJS.Signals | null) => {
        clearTimeout(timer);
        const finishedAt = new Date();
        resolve({
          id,
          mode: this.cfg.execMode,
          command: display,
          args,
          exitCode,
          signal,
          timedOut,
          stdout,
          stderr,
          startedAt: startedAt.toISOString(),
          finishedAt: finishedAt.toISOString(),
          durationMs: finishedAt.getTime() - startedAt.getTime(),
        });
      };

      child.on("error", (err) => {
        stderr = append(stderr, Buffer.from(`spawn error: ${String(err)}`));
        finish(null, null);
      });

      child.on("close", (code, signal) => finish(code, signal));
    });
  }
}
