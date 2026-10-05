import type { Request, Response, NextFunction } from "express";
import crypto from "node:crypto";

/** Requests carry a traceId that follows the whole processing flow. */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      traceId: string;
    }
  }
}

const TRACE_HEADER = "x-trace-id";
// Accept only sane client-supplied ids; otherwise generate our own.
const VALID_TRACE = /^[\w-]{1,64}$/;

/**
 * Attaches a traceId to every request. Reuses the client's `x-trace-id`
 * header when present and valid, otherwise generates one. Echoes it back
 * in the response header so callers can correlate logs.
 */
export function traceMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header(TRACE_HEADER);
  const traceId =
    incoming && VALID_TRACE.test(incoming) ? incoming : crypto.randomBytes(8).toString("hex");
  req.traceId = traceId;
  res.setHeader(TRACE_HEADER, traceId);
  next();
}
