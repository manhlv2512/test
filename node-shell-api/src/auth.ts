import type { Request, Response, NextFunction } from "express";
import crypto from "node:crypto";

/**
 * API-key middleware. Clients must send the key in the `x-api-key` header.
 * If `apiKey` is empty, auth is disabled (useful for local testing only).
 */
export function apiKeyAuth(apiKey: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!apiKey) {
      next();
      return;
    }
    const provided = req.header("x-api-key") ?? "";
    if (safeEqual(provided, apiKey)) {
      next();
      return;
    }
    res.status(401).json({ error: "Unauthorized: invalid or missing x-api-key" });
  };
}

/** Constant-time comparison to avoid timing attacks. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}
