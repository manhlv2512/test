import express, { type Request, type Response } from "express";
import { loadConfig } from "./config";
import { Logger } from "./logger";
import { apiKeyAuth } from "./auth";
import { ScriptExecutor } from "./executor";
import { traceMiddleware } from "./trace";

const cfg = loadConfig();
const logger = new Logger(cfg.logDir);
const executor = new ScriptExecutor(cfg);

const app = express();
app.use(express.json({ limit: "256kb" }));
// Attach a traceId to every request so a whole flow can be followed in logs.
app.use(traceMiddleware);

// Health check (no auth) so orchestrators can probe it.
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    target: executor.describeTarget(),
    time: new Date().toISOString(),
  });
});

// All routes below require the API key.
app.use(apiKeyAuth(cfg.apiKey));

/**
 * POST /execute
 * Body: { "args"?: string[], "env"?: { [k: string]: string } }
 * Runs the configured .sh script synchronously and returns its output.
 */
app.post("/execute", async (req: Request, res: Response) => {
  const traceId = req.traceId;

  if (!executor.isReady()) {
    logger.error(`Script not found at ${cfg.scriptPath}`, traceId);
    res.status(404).json({ traceId, error: `Script not found: ${cfg.scriptPath}` });
    return;
  }

  const validated = executor.validateArgs(req.body?.args);
  if (!validated.ok) {
    logger.warn(`Rejected request: ${validated.error}`, traceId);
    res.status(400).json({ traceId, error: validated.error });
    return;
  }

  const envOverride =
    req.body?.env && typeof req.body.env === "object" ? (req.body.env as Record<string, string>) : {};

  logger.info(`Executing (mode=${cfg.execMode}) args=${JSON.stringify(validated.args)}`, traceId);

  try {
    const result = await executor.run({ traceId, args: validated.args, env: envOverride });
    const logFile = logger.saveExecution(
      result.id,
      [
        `traceId: ${result.id}`,
        `mode: ${result.mode}`,
        `command: ${result.command}`,
        `args: ${JSON.stringify(result.args)}`,
        `exitCode: ${result.exitCode}`,
        `signal: ${result.signal}`,
        `timedOut: ${result.timedOut}`,
        `durationMs: ${result.durationMs}`,
        `--- STDOUT ---`,
        result.stdout,
        `--- STDERR ---`,
        result.stderr,
      ].join("\n")
    );

    const success = result.exitCode === 0 && !result.timedOut;
    logger.info(
      `Execution finished exitCode=${result.exitCode} timedOut=${result.timedOut} durationMs=${result.durationMs}`,
      traceId
    );

    res.status(success ? 200 : 500).json({ ...result, traceId, success, logFile });
  } catch (err) {
    logger.error(`Execution failed: ${String(err)}`, traceId);
    res.status(500).json({ traceId, error: "Internal error while executing script", detail: String(err) });
  }
});

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});

const server = app.listen(cfg.port, cfg.host, () => {
  logger.info(`node-shell-api listening on ${cfg.host}:${cfg.port}`);
  logger.info(`script=${cfg.scriptPath} shell=${cfg.shell} timeout=${cfg.execTimeoutMs}ms auth=${cfg.apiKey ? "on" : "off"}`);
});

const shutdown = (sig: string) => {
  logger.info(`Received ${sig}, shutting down`);
  server.close(() => process.exit(0));
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
