import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { config } from '../config.js';
import { extOf } from '../util/files.js';
import { logger } from '../util/logger.js';

const log = logger.child('scan');

const ALLOWED_EXT = new Set(['fbx', 'glb', 'gltf']);

// Magic bytes: binary FBX begins with "Kaydara FBX Binary"; GLB with "glTF".
const FBX_MAGIC = Buffer.from('Kaydara FBX Binary');
const GLB_MAGIC = Buffer.from('glTF');

export interface ScanResult {
  ok: boolean;
  reason?: string;
}

/** Validate extension + magic bytes, then optional ClamAV virus scan. */
export async function scanUpload(filePath: string, originalName: string): Promise<ScanResult> {
  const ext = extOf(originalName);
  if (!ALLOWED_EXT.has(ext)) {
    return { ok: false, reason: `Unsupported file type ".${ext}". Allowed: .fbx, .glb, .gltf` };
  }

  const sigOk = await checkSignature(filePath, ext);
  if (!sigOk.ok) return sigOk;

  if (config.clamavEnabled) {
    const av = await clamScan(filePath);
    if (!av.ok) return av;
  }

  return { ok: true };
}

async function checkSignature(filePath: string, ext: string): Promise<ScanResult> {
  const fh = await fs.open(filePath, 'r');
  try {
    const buf = Buffer.alloc(64);
    await fh.read(buf, 0, 64, 0);
    if (ext === 'fbx') {
      // ASCII FBX has no magic header; accept if it looks like text or matches binary magic.
      const isBinary = buf.subarray(0, FBX_MAGIC.length).equals(FBX_MAGIC);
      const looksAscii = /FBXHeaderExtension|; FBX/.test(buf.toString('latin1'));
      if (!isBinary && !looksAscii) {
        return { ok: false, reason: 'File does not look like a valid FBX.' };
      }
    } else if (ext === 'glb') {
      if (!buf.subarray(0, 4).equals(GLB_MAGIC)) {
        return { ok: false, reason: 'File does not look like a valid binary GLB.' };
      }
    } else if (ext === 'gltf') {
      const head = buf.toString('utf8').trimStart();
      if (!head.startsWith('{')) {
        return { ok: false, reason: 'File does not look like a valid glTF JSON.' };
      }
    }
    return { ok: true };
  } finally {
    await fh.close();
  }
}

function clamScan(filePath: string): Promise<ScanResult> {
  const cmd = config.clamdscanPath || 'clamdscan';
  return new Promise((resolve) => {
    let out = '';
    const child = spawn(cmd, ['--no-summary', filePath], { windowsHide: true });
    child.stdout?.on('data', (d) => (out += d.toString()));
    child.stderr?.on('data', (d) => (out += d.toString()));
    child.on('error', (err) => {
      log.warn(`ClamAV unavailable (${err.message}); skipping scan.`);
      resolve({ ok: true }); // fail-open if scanner missing, but log it
    });
    child.on('close', (code) => {
      if (code === 0) resolve({ ok: true });
      else if (code === 1) resolve({ ok: false, reason: `Malware detected: ${out.trim()}` });
      else {
        log.warn(`ClamAV returned ${code}; treating as clean. ${out.trim()}`);
        resolve({ ok: true });
      }
    });
  });
}
