import { Router, Request, Response, NextFunction } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { nanoid } from 'nanoid';
import { config } from '../config.js';
import { uploadSingle } from '../middleware/upload.js';
import { convertRateLimiter } from '../middleware/rateLimit.js';
import { scanUpload } from '../security/scan.js';
import { ensureDir, extOf, safeBaseName } from '../util/files.js';
import { jobStore } from '../queue/jobStore.js';
import { submitJob } from '../services/worker.js';
import { Direction, Job, toJobView } from '../types.js';
import { DEFAULT_OPTIMIZE, OptimizeOptions, TextureFormat } from '../converters/optimizeGlb.js';

export const convertRouter = Router();

/** Infer conversion direction from the request body or the file extension. */
function resolveDirection(requested: unknown, ext: string): Direction | null {
  if (requested === 'fbx2glb' || requested === 'glb2fbx') return requested;
  if (ext === 'fbx') return 'fbx2glb';
  if (ext === 'glb' || ext === 'gltf') return 'glb2fbx';
  return null;
}

function asBool(v: unknown): boolean {
  return v === 'true' || v === '1' || v === true;
}

/** Parse optional optimization fields from the multipart body. */
function parseOptions(body: Record<string, unknown>): OptimizeOptions {
  const fmt = body.textureFormat;
  const textureFormat: TextureFormat = fmt === 'webp' || fmt === 'jpeg' ? fmt : 'keep';
  const size = Number.parseInt(String(body.maxTextureSize ?? ''), 10);
  return {
    draco: asBool(body.draco),
    cleanup: asBool(body.cleanup),
    textureFormat,
    maxTextureSize: Number.isFinite(size) && size > 0 ? size : 0,
  };
}

convertRouter.post(
  '/convert',
  convertRateLimiter,
  (req: Request, res: Response, next: NextFunction) => {
    uploadSingle(req, res, (err) => (err ? next(err) : next()));
  },
  async (req: Request, res: Response, next: NextFunction) => {
    const file = req.file;
    try {
      if (!file) {
        res.status(400).json({ error: 'No file uploaded. Send a multipart field named "file".' });
        return;
      }

      const ext = extOf(file.originalname);
      const direction = resolveDirection(req.body?.direction, ext);
      if (!direction) {
        await fs.rm(file.path, { force: true });
        res.status(400).json({ error: 'Could not determine conversion direction.' });
        return;
      }

      // Verify the chosen direction matches the actual file type.
      const expectsFbx = direction === 'fbx2glb';
      if (expectsFbx && ext !== 'fbx') {
        await fs.rm(file.path, { force: true });
        res.status(400).json({ error: 'FBX→GLB selected but the uploaded file is not an FBX.' });
        return;
      }
      if (!expectsFbx && ext !== 'glb' && ext !== 'gltf') {
        await fs.rm(file.path, { force: true });
        res.status(400).json({ error: 'GLB→FBX selected but the uploaded file is not a GLB/glTF.' });
        return;
      }

      // Security: signature + optional virus scan.
      const scan = await scanUpload(file.path, file.originalname);
      if (!scan.ok) {
        await fs.rm(file.path, { force: true });
        res.status(422).json({ error: scan.reason });
        return;
      }

      // Move the staged upload into a dedicated per-job directory.
      const jobId = nanoid();
      const jobDir = path.join(config.jobsDir, jobId);
      await ensureDir(jobDir);
      const inputName = safeBaseName(file.originalname);
      const inputPath = path.join(jobDir, inputName);
      await fs.rename(file.path, inputPath);

      // Optimization only applies to GLB output (the FBX→GLB direction).
      const options =
        direction === 'fbx2glb' ? parseOptions(req.body ?? {}) : { ...DEFAULT_OPTIMIZE };
      const outputUpAxis = req.body?.outputUpAxis === 'z' ? 'z' : 'y';

      const now = Date.now();
      const job: Job = {
        id: jobId,
        direction,
        status: 'queued',
        progress: { percent: 0, label: 'Queued' },
        inputName,
        inputPath,
        inputSize: file.size,
        options,
        outputUpAxis,
        createdAt: now,
        updatedAt: now,
      };
      jobStore.create(job);
      submitJob(jobId);

      res.status(202).json({ job: toJobView(job) });
    } catch (err) {
      if (file?.path) await fs.rm(file.path, { force: true }).catch(() => {});
      next(err);
    }
  },
);
