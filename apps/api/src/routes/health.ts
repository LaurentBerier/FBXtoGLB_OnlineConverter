import { Router, Request, Response } from 'express';
import { config } from '../config.js';
import { detectTools } from '../converters/tools.js';
import { conversionQueue } from '../services/worker.js';

export const healthRouter = Router();

healthRouter.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

/**
 * Capabilities endpoint — the frontend uses this to show which directions are
 * currently available (i.e. whether the engines are installed).
 */
healthRouter.get('/capabilities', async (_req: Request, res: Response) => {
  const tools = await detectTools();
  res.json({
    limits: {
      maxFileSizeMb: config.maxFileSizeMb,
      retentionHours: config.retentionHours,
    },
    queue: { running: conversionQueue.running, depth: conversionQueue.depth },
    engines: {
      fbx2gltf: { available: tools.fbx2gltf.available, version: tools.fbx2gltf.version },
      blender: { available: tools.blender.available, version: tools.blender.version },
    },
    directions: {
      fbx2glb: tools.fbx2gltf.available,
      glb2fbx: tools.blender.available,
    },
    // Optimization runs in-process (gltf-transform), always available for GLB output.
    optimization: { available: true, appliesTo: 'fbx2glb' },
  });
});
