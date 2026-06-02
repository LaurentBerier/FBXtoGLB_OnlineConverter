import { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { config } from '../config.js';
import { logger } from '../util/logger.js';

const log = logger.child('http');

/** Centralised error handler — turns thrown/forwarded errors into JSON. */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ error: `File exceeds the ${config.maxFileSizeMb} MB limit.` });
      return;
    }
    res.status(400).json({ error: `Upload error: ${err.message}` });
    return;
  }

  const message = err instanceof Error ? err.message : 'Unexpected server error';
  const status = (err as { status?: number })?.status ?? 400;
  if (status >= 500) log.error('unhandled error', message);
  res.status(status).json({ error: message });
}

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Not found' });
}
