import express, { Express } from 'express';
import cors from 'cors';
import { config } from './config.js';
import { convertRouter } from './routes/convert.js';
import { jobsRouter } from './routes/jobs.js';
import { healthRouter } from './routes/health.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(
    cors({
      origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(',').map((s) => s.trim()),
    }),
  );
  // Only parse small JSON bodies; uploads are multipart and handled by multer.
  app.use(express.json({ limit: '256kb' }));

  app.use('/api', healthRouter);
  app.use('/api', convertRouter);
  app.use('/api', jobsRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
