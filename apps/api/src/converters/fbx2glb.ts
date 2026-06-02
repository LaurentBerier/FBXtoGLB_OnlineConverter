import path from 'node:path';
import { detectFbx2gltf, execTool } from './tools.js';
import { fileSize, pathExists } from '../util/files.js';
import { logger } from '../util/logger.js';

const log = logger.child('fbx2glb');

export interface ConvertResult {
  outputPath: string;
  notes: string[];
}

export class ConverterUnavailableError extends Error {}
export class ConversionFailedError extends Error {}

/**
 * Convert an FBX file to a binary GLB using FBX2glTF, which preserves
 * skeletons, skin clusters, animations and PBR materials with embedded textures.
 */
export async function convertFbxToGlb(
  inputPath: string,
  outputPath: string,
  onLog?: (line: string) => void,
): Promise<ConvertResult> {
  const tool = await detectFbx2gltf();
  if (!tool.available || !tool.path) {
    throw new ConverterUnavailableError(
      'FBX2glTF is not installed. Download it from https://github.com/godotengine/FBX2glTF/releases ' +
        'and set FBX2GLTF_PATH, or drop the binary in ./bin.',
    );
  }

  const notes: string[] = [];
  if (tool.version) notes.push(`Engine: ${tool.version}`);

  // --binary => .glb, --embed => embed textures, --pbr-metallic-roughness => keep PBR,
  // --keep-attribute auto keeps normals/uv/joints/weights/colors as present.
  const args = [
    '--input',
    inputPath,
    '--output',
    outputPath,
    '--binary',
    '--embed',
    '--pbr-metallic-roughness',
    '--keep-attribute',
    'auto',
  ];

  log.info(`Running FBX2glTF on ${path.basename(inputPath)}`);
  const { code, out } = await execTool(tool.path, args, { onLog });

  // FBX2glTF sometimes writes to "<output>_out/<name>.glb"; resolve either layout.
  const resolved = await resolveOutput(outputPath, out);
  if (code !== 0 || !resolved) {
    const tail = out.split('\n').slice(-12).join('\n');
    throw new ConversionFailedError(`FBX2glTF exited with code ${code}. Log:\n${tail}`);
  }

  if ((await fileSize(resolved)) === 0) {
    throw new ConversionFailedError('FBX2glTF produced an empty GLB.');
  }

  return { outputPath: resolved, notes };
}

/** FBX2glTF builds vary; find the actual GLB it wrote. */
async function resolveOutput(outputPath: string, log: string): Promise<string | null> {
  if (await pathExists(outputPath)) return outputPath;

  const dir = path.dirname(outputPath);
  const base = path.basename(outputPath, path.extname(outputPath));
  const candidates = [
    outputPath,
    path.join(dir, `${base}_out`, `${base}.glb`),
    path.join(dir, `${base}.glb`),
  ];
  for (const c of candidates) {
    if (await pathExists(c)) return c;
  }
  // Last resort: scrape a path out of the tool log.
  const m = log.match(/Wrote\s+(.+\.glb)/i);
  if (m && (await pathExists(m[1].trim()))) return m[1].trim();
  return null;
}
