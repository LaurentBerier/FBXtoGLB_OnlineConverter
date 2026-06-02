import rateLimit from 'express-rate-limit';
import { config } from '../config.js';

/** Sliding-window per-IP limiter applied to the conversion endpoints. */
export const convertRateLimiter = rateLimit({
  windowMs: config.rateLimitWindowMinutes * 60 * 1000,
  max: config.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down and try again shortly.' },
});
