import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { jobStore } from '../queue/jobStore.js';
import { removeDir } from '../util/files.js';
import { logger } from '../util/logger.js';

const log = logger.child('cleanup');

/**
 * Delete job working directories older than the retention window and forget
 * their in-memory records. Satisfies the "auto-delete after 24h" requirement.
 */
export async function sweepOnce(now = Date.now()): Promise<number> {
  const maxAgeMs = config.retentionHours * 60 * 60 * 1000;
  let removed = 0;

  // 1. Forget + delete expired jobs we know about.
  for (const job of jobStore.all()) {
    if (now - job.createdAt > maxAgeMs) {
      await removeDir(path.dirname(job.inputPath)).catch(() => {});
      jobStore.delete(job.id);
      removed++;
    }
  }

  // 2. Sweep orphaned directories on disk (e.g. after a restart).
  try {
    const entries = await fs.readdir(config.jobsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const dir = path.join(config.jobsDir, entry.name);
      const stat = await fs.stat(dir).catch(() => null);
      if (stat && now - stat.mtimeMs > maxAgeMs) {
        await removeDir(dir).catch(() => {});
        removed++;
      }
    }
  } catch {
    // jobs dir may not exist yet
  }

  if (removed) log.info(`swept ${removed} expired job(s)`);
  return removed;
}

let timer: NodeJS.Timeout | null = null;

export function startCleanupSweeper(): void {
  const intervalMs = config.cleanupIntervalMinutes * 60 * 1000;
  void sweepOnce();
  timer = setInterval(() => void sweepOnce(), intervalMs);
  timer.unref?.();
  log.info(`cleanup sweeper running every ${config.cleanupIntervalMinutes}m (retention ${config.retentionHours}h)`);
}

export function stopCleanupSweeper(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
