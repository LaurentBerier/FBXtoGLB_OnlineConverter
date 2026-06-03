import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectBlender, execTool } from './tools.js';
import { fileSize, pathExists } from '../util/files.js';
import { logger } from '../util/logger.js';
import { ConversionFailedError, ConverterUnavailableError, ConvertResult } from './fbx2glb.js';

const log = logger.child('glb2fbx');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Python script lives alongside the source; copied to dist by the build step.
const SCRIPT = path.join(__dirname, '..', 'scripts', 'glb_to_fbx.py');

/**
 * Convert a GLB/glTF to FBX using headless Blender. The Python script imports
 * the glTF (armature + skin weights + animations + materials) and exports FBX
 * with those features enabled.
 */
export async function convertGlbToFbx(
  inputPath: string,
  outputPath: string,
  upAxis: 'y' | 'z' = 'y',
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
  if (tool.version) notes.push(`Engine: ${tool.version}`);

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
    '--up-axis',
    upAxis,
  ];

  log.info(`Running Blender GLB→FBX on ${path.basename(inputPath)}`);
  const { code, out } = await execTool(tool.path, args, { onLog });

  if (code !== 0 || !(await pathExists(outputPath))) {
    const tail = out.split('\n').slice(-15).join('\n');
    throw new ConversionFailedError(`Blender exited with code ${code}. Log:\n${tail}`);
  }
  if ((await fileSize(outputPath)) === 0) {
    throw new ConversionFailedError('Blender produced an empty FBX.');
  }

  return { outputPath, notes };
}
