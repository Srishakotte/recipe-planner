import { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError, ZodType } from 'zod';

/** Throw from any handler to send a specific status + message. */
export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: Record<string, unknown>) {
    super(message);
  }
}

/** Wraps an async route so thrown errors reach the error middleware (Express 4 doesn't do this). */
export const asyncHandler = (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
  (req, res, next) => { fn(req, res).catch(next); };

/** Parses and validates a request body; throws a 400 with readable messages on failure. */
export function parseBody<T>(schema: ZodType<T>, body: unknown): T {
  return schema.parse(body);
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    const message = err.issues.map(i => `${i.path.join('.') || 'body'}: ${i.message}`).join('; ');
    res.status(400).json({ error: message });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, ...err.details });
    return;
  }
  // Prisma "record not found"
  if (typeof err === 'object' && err && (err as { code?: string }).code === 'P2025') {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
}

/** YYYY-MM-DD in local time (toISOString would shift to UTC and can change the day). */
export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** "2026-11-16" -> [that day, +days) as a Prisma date filter */
export function dateRange(start: string, days = 7) {
  const gte = new Date(start);
  const lt = new Date(gte);
  lt.setDate(lt.getDate() + days);
  return { gte, lt };
}
