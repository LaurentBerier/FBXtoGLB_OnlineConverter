import { spawn } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { readdirSync, existsSync } from 'node:fs';
import { config } from '../config.js';
import { pathExists } from '../util/files.js';
import { logger } from '../util/logger.js';

const log = logger.child('tools');

export interface ToolInfo {
  name: string;
  available: boolean;
  path: string | null;
  version: string | null;
}

const isWin = process.platform === 'win32';

/** Candidate executable names per platform. */
const FBX2GLTF_NAMES = isWin
  ? ['FBX2glTF.exe', 'FBX2glTF-windows-x64.exe', 'FBX2glTF.exe']
  : process.platform === 'darwin'
    ? ['FBX2glTF', 'FBX2glTF-darwin-x64', 'FBX2glTF-macos']
    : ['FBX2glTF', 'FBX2glTF-linux-x64'];

const BLENDER_NAMES = isWin ? ['blender.exe', 'blender'] : ['blender'];

/** Common install locations to probe when the binary is not on PATH. */
function blenderGuesses(): string[] {
  if (isWin) {
    // Scan the "Blender Foundation" folder for any installed version (4.x, 5.x,
    // future) rather than hardcoding versions, newest first.
    const bases = [
      process.env['ProgramW6432'],
      process.env['ProgramFiles'],
      process.env['ProgramFiles(x86)'],
      'C:/Program Files',
    ].filter((b): b is string => !!b);
    const found: string[] = [];
    for (const base of bases) {
      const dir = path.join(base, 'Blender Foundation');
      try {
        for (const sub of readdirSync(dir)) {
          const exe = path.join(dir, sub, 'blender.exe');
          if (existsSync(exe) && !found.includes(exe)) found.push(exe);
        }
      } catch {
        /* folder not present on this base — ignore */
      }
    }
    found.sort().reverse(); // "Blender 5.1" before "Blender 4.2"
    return found;
  }
  if (process.platform === 'darwin') {
    return ['/Applications/Blender.app/Contents/MacOS/Blender'];
  }
  return ['/usr/bin/blender', '/usr/local/bin/blender', '/snap/bin/blender'];
}

/** Local bin/ folder inside the repo where users may drop FBX2glTF. */
const localBinDir = path.resolve(process.cwd(), 'bin');

async function which(name: string): Promise<string | null> {
  const dirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  dirs.unshift(localBinDir);
  for (const dir of dirs) {
    const candidate = path.join(dir, name);
    if (await pathExists(candidate)) return candidate;
  }
  return null;
}

function run(cmd: string, args: string[], timeoutMs = 8000): Promise<{ code: number; out: string }> {
  return new Promise((resolve) => {
    let out = '';
    let settled = false;
    const child = spawn(cmd, args, { windowsHide: true });
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        child.kill();
        resolve({ code: -1, out });
      }
    }, timeoutMs);
    child.stdout?.on('data', (d) => (out += d.toString()));
    child.stderr?.on('data', (d) => (out += d.toString()));
    child.on('error', () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve({ code: -1, out });
      }
    });
    child.on('close', (code) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve({ code: code ?? -1, out });
      }
    });
  });
}

async function resolveBinary(explicit: string, names: string[], guesses: string[]): Promise<string | null> {
  if (explicit) {
    if (path.isAbsolute(explicit)) return (await pathExists(explicit)) ? explicit : null;
    // treat as a command name on PATH
    return (await which(explicit)) ?? explicit;
  }
  for (const n of names) {
    const found = await which(n);
    if (found) return found;
  }
  for (const g of guesses) {
    if (await pathExists(g)) return g;
  }
  return null;
}

export async function detectFbx2gltf(): Promise<ToolInfo> {
  const bin = await resolveBinary(config.fbx2gltfPath, FBX2GLTF_NAMES, []);
  if (!bin) return { name: 'FBX2glTF', available: false, path: null, version: null };
  const { code, out } = await run(bin, ['--version']);
  const version = code === 0 ? out.trim().split('\n')[0] : null;
  return { name: 'FBX2glTF', available: true, path: bin, version };
}

export async function detectBlender(): Promise<ToolInfo> {
  const bin = await resolveBinary(config.blenderPath, BLENDER_NAMES, blenderGuesses());
  if (!bin) return { name: 'Blender', available: false, path: null, version: null };
  const { code, out } = await run(bin, ['--version']);
  const version = code === 0 ? out.trim().split('\n')[0] : null;
  return { name: 'Blender', available: !!version || code === 0, path: bin, version };
}

/** Cached probe used by routes; refreshed on demand. */
let cache: { fbx2gltf: ToolInfo; blender: ToolInfo; at: number } | null = null;

export async function detectTools(force = false): Promise<{ fbx2gltf: ToolInfo; blender: ToolInfo }> {
  if (!force && cache && Date.now() - cache.at < 30_000) return cache;
  const [fbx2gltf, blender] = await Promise.all([detectFbx2gltf(), detectBlender()]);
  cache = { fbx2gltf, blender, at: Date.now() };
  if (!fbx2gltf.available) log.warn('FBX2glTF not found — FBX→GLB conversions will fail until installed.');
  if (!blender.available) log.warn('Blender not found — GLB→FBX conversions will fail until installed.');
  return cache;
}

/** Returns a tmp working dir under the OS temp space. */
export async function makeTempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

/** Run a converter process, streaming logs; resolves with combined output. */
export function execTool(
  cmd: string,
  args: string[],
  opts: { cwd?: string; timeoutMs?: number; onLog?: (line: string) => void } = {},
): Promise<{ code: number; out: string }> {
  const timeoutMs = opts.timeoutMs ?? 1000 * 60 * 15; // 15 min cap
  return new Promise((resolve, reject) => {
    let out = '';
    const child = spawn(cmd, args, { cwd: opts.cwd, windowsHide: true });
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`Converter timed out after ${Math.round(timeoutMs / 1000)}s`));
    }, timeoutMs);
    const onData = (d: Buffer) => {
      const s = d.toString();
      out += s;
      opts.onLog?.(s.trimEnd());
    };
    child.stdout?.on('data', onData);
    child.stderr?.on('data', onData);
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? -1, out });
    });
  });
}
