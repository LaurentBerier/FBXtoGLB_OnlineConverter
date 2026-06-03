import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectBlender, execTool } from './tools.js';
import { fileSize, pathExists } from '../util/files.js';
import { logger } from '../util/logger.js';
import { ConversionFailedError, ConverterUnavailableError, ConvertResult } from './fbx2glb.js';

const log = logger.child('fbx2glb-blender');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Python script lives alongside the source; copied to dist by the build step.
const SCRIPT = path.join(__dirname, '..', 'scripts', 'fbx_to_glb.py');

/**
 * Convert an FBX to a binary GLB using headless Blender. Preferred over
 * FBX2glTF because Blender keeps smooth normals + tangents, links normal/PBR
 * maps, and re-encodes textures to PNG (GLB-conformant). The output is Y-up;
 * a Z-up GLB is produced afterwards by the gltf-transform pivot (see upAxis.ts).
 */
export async function convertFbxToGlbViaBlender(
  inputPath: string,
  outputPath: string,
  onLog?: (line: string) => void,
): Promise<ConvertResult> {
  const tool = await detectBlender();
  if (!tool.available || !tool.path) {
    throw new ConverterUnavailableError(
      'Blender is not installed. Install Blender 3.6+ from https://www.blender.org/download/ ' +
        'and set BLENDER_PATH (or put blender on PATH).',
    );
  }

  if (!(await pathExists(SCRIPT))) {
    throw new ConversionFailedError(`Blender bridge script missing at ${SCRIPT}`);
  }

  const notes: string[] = [];
  if (tool.version) notes.push(`Engine: ${tool.version} (Blender)`);

  const args = [
    '--background',
    '--factory-startup',
    '--python-exit-code',
    '1',
    '--python',
    SCRIPT,
    '--',
    '--input',
    inputPath,
    '--output',
    outputPath,
  ];

  log.info(`Running Blender FBX→GLB on ${path.basename(inputPath)}`);
  const { code, out } = await execTool(tool.path, args, { onLog });

  if (code !== 0 || !(await pathExists(outputPath))) {
    const tail = out.split('\n').slice(-15).join('\n');
    throw new ConversionFailedError(`Blender exited with code ${code}. Log:\n${tail}`);
  }
  if ((await fileSize(outputPath)) === 0) {
    throw new ConversionFailedError('Blender produced an empty GLB.');
  }

  return { outputPath, notes };
}
