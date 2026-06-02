import { config } from './config.js';
import { createApp } from './app.js';
import { ensureDir } from './util/files.js';
import { logger } from './util/logger.js';
import { detectTools } from './converters/tools.js';
import { startCleanupSweeper } from './services/cleanup.js';

const log = logger.child('server');

async function main(): Promise<void> {
  // Make sure storage directories exist before accepting uploads.
  await ensureDir(config.uploadsDir);
  await ensureDir(config.jobsDir);

  const app = createApp();

  const server = app.listen(config.port, config.host, () => {
    log.info(`API listening on http://${config.host}:${config.port}`);
    log.info(`CORS origin: ${config.corsOrigin}`);
  });

  startCleanupSweeper();

  // Probe engines on boot so operators see a clear warning if they are missing.
  const tools = await detectTools(true);
  log.info(
    `engines: FBX2glTF=${tools.fbx2gltf.available ? tools.fbx2gltf.version || 'ok' : 'MISSING'}, ` +
      `Blender=${tools.blender.available ? tools.blender.version || 'ok' : 'MISSING'}`,
  );

  const shutdown = (signal: string) => {
    log.info(`${signal} received, shutting down`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  log.error('fatal startup error', (err as Error).message);
  process.exit(1);
});
