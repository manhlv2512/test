import fs from "node:fs";
import path from "node:path";

/**
 * Logging strategy:
 *  - Application logs go to stdout/stderr via console.* — the process manager
 *    (PM2 / Docker / systemd) captures, stores and rotates them. No app-level
 *    log file is written, to avoid duplicating what those tools already do.
 *  - Per-execution logs ARE written to disk (LOG_DIR/executions/...), because
 *    no process manager produces a separate, complete record per script run.
 *    This is the audit trail for each install/uninstall execution.
 *
 * Every log line can carry a `traceId` so a single processing flow (incoming
 * request -> script execution -> response) can be followed end-to-end across
 * all log lines and its execution file.
 */
export class Logger {
  private execDir: string;

  constructor(logDir: string) {
    this.execDir = path.join(logDir, "executions");
    try {
      fs.mkdirSync(this.execDir, { recursive: true });
    } catch (err) {
      console.error(`[logger] Failed to create execution log dir ${this.execDir}:`, err);
    }
  }

  private format(level: string, msg: string, traceId?: string): string {
    const trace = traceId ? ` [${traceId}]` : "";
    return `${new Date().toISOString()} ${level}${trace} ${msg}`;
  }

  info(msg: string, traceId?: string): void {
    console.log(this.format("INFO ", msg, traceId));
  }

  warn(msg: string, traceId?: string): void {
    console.warn(this.format("WARN ", msg, traceId));
  }

  error(msg: string, traceId?: string): void {
    console.error(this.format("ERROR", msg, traceId));
  }

  /**
   * Persist the full result of one script execution to its own file.
   * The file name is prefixed with the traceId so it is trivial to locate
   * the record for a given processing flow.
   */
  saveExecution(traceId: string, content: string): string {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const file = path.join(this.execDir, `${stamp}-${traceId}.log`);
    try {
      fs.writeFileSync(file, content);
    } catch (err) {
      this.error(`Failed to write execution log ${file}: ${String(err)}`, traceId);
    }
    return file;
  }
}
