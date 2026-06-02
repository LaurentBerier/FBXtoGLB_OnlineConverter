import 'dotenv/config';
import path from 'node:path';

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

function bool(name: string, fallback = false): boolean {
  const raw = process.env[name];
  if (raw == null) return fallback;
  return /^(1|true|yes|on)$/i.test(raw.trim());
}

const storageDir = path.resolve(process.env.STORAGE_DIR || './storage');

export const config = {
  port: int('API_PORT', 4000),
  host: process.env.API_HOST || '0.0.0.0',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',

  storageDir,
  uploadsDir: path.join(storageDir, 'uploads'),
  jobsDir: path.join(storageDir, 'jobs'),
  retentionHours: int('RETENTION_HOURS', 24),
  cleanupIntervalMinutes: int('CLEANUP_INTERVAL_MINUTES', 30),

  maxFileSizeBytes: int('MAX_FILE_SIZE_MB', 500) * 1024 * 1024,
  maxFileSizeMb: int('MAX_FILE_SIZE_MB', 500),
  rateLimitWindowMinutes: int('RATE_LIMIT_WINDOW_MINUTES', 15),
  rateLimitMax: int('RATE_LIMIT_MAX_REQUESTS', 60),
  maxConcurrentJobs: int('MAX_CONCURRENT_JOBS', 2),

  fbx2gltfPath: process.env.FBX2GLTF_PATH?.trim() || '',
  blenderPath: process.env.BLENDER_PATH?.trim() || '',

  clamavEnabled: bool('CLAMAV_ENABLED', false),
  clamdscanPath: process.env.CLAMDSCAN_PATH?.trim() || '',

  isProd: process.env.NODE_ENV === 'production',
} as const;

export type AppConfig = typeof config;
