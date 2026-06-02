import { NodeIO, Transform } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld, draco, textureCompress } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import sharp from 'sharp';
import { fileSize } from '../util/files.js';
import { logger } from '../util/logger.js';

const log = logger.child('optimize');

export type TextureFormat = 'keep' | 'webp' | 'jpeg';

export interface OptimizeOptions {
  /** Draco mesh compression (lossy geometry, big size win). */
  draco: boolean;
  /** prune + dedup unused/duplicate data (lossless). */
  cleanup: boolean;
  /** Re-encode textures to this format, or keep originals. */
  textureFormat: TextureFormat;
  /** Cap texture dimensions (px), preserving aspect ratio. 0/undefined = keep. */
  maxTextureSize?: number;
}

export const DEFAULT_OPTIMIZE: OptimizeOptions = {
  draco: false,
  cleanup: false,
  textureFormat: 'keep',
  maxTextureSize: 0,
};

export function hasAnyOptimization(o: OptimizeOptions): boolean {
  return o.draco || o.cleanup || o.textureFormat !== 'keep' || !!o.maxTextureSize;
}

export interface OptimizeResult {
  beforeBytes: number;
  afterBytes: number;
  notes: string[];
}

// Draco encoder/decoder modules are async to load — build the IO once and reuse.
let ioPromise: Promise<NodeIO> | null = null;
async function getIO(): Promise<NodeIO> {
  if (!ioPromise) {
    ioPromise = (async () => {
      const [encoder, decoder] = await Promise.all([
        draco3d.createEncoderModule(),
        draco3d.createDecoderModule(),
      ]);
      return new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
        'draco3d.encoder': encoder,
        'draco3d.decoder': decoder,
      });
    })();
  }
  return ioPromise;
}

/**
 * Optimize a GLB in place. Returns null when no option is enabled.
 * Order matters: weld (required for Draco) -> cleanup -> textures -> Draco.
 */
export async function optimizeGlb(path: string, options: OptimizeOptions): Promise<OptimizeResult | null> {
  if (!hasAnyOptimization(options)) return null;

  const beforeBytes = await fileSize(path);
  const io = await getIO();
  const doc = await io.read(path);

  const notes: string[] = [];
  const transforms: Transform[] = [];

  // Welding (merge identical vertices) is required before Draco and helps cleanup.
  if (options.draco || options.cleanup) transforms.push(weld());

  if (options.cleanup) {
    transforms.push(dedup(), prune());
    notes.push('Cleanup: pruned unused + deduplicated data');
  }

  if (options.textureFormat !== 'keep' || options.maxTextureSize) {
    const texOpts: Parameters<typeof textureCompress>[0] = { encoder: sharp };
    if (options.textureFormat !== 'keep') texOpts.targetFormat = options.textureFormat;
    if (options.maxTextureSize) texOpts.resize = [options.maxTextureSize, options.maxTextureSize];
    transforms.push(textureCompress(texOpts));
    const parts = [
      options.textureFormat !== 'keep' ? options.textureFormat.toUpperCase() : null,
      options.maxTextureSize ? `≤${options.maxTextureSize}px` : null,
    ].filter(Boolean);
    notes.push(`Textures: ${parts.join(', ')}`);
  }

  if (options.draco) {
    // quantizeGeneric drives skin-weight precision — keep it high to protect rigging.
    transforms.push(draco({ quantizeGeneric: 16 }));
    notes.push('Geometry: Draco compressed (lossy)');
  }

  await doc.transform(...transforms);
  await io.write(path, doc);

  const afterBytes = await fileSize(path);
  log.info(`optimized ${beforeBytes} -> ${afterBytes} bytes`);
  return { beforeBytes, afterBytes, notes };
}
