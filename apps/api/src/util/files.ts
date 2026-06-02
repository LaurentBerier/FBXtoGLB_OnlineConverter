import fs from 'node:fs/promises';
import path from 'node:path';

export async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

export async function removeDir(dir: string): Promise<void> {
  await fs.rm(dir, { recursive: true, force: true });
}

export async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function fileSize(p: string): Promise<number> {
  try {
    const s = await fs.stat(p);
    return s.size;
  } catch {
    return 0;
  }
}

/** Strip directory components and dangerous characters from a client filename. */
export function safeBaseName(name: string): string {
  // basename() removes any path the client tried to smuggle in.
  const base = path.basename(name);
  const cleaned = base
    .replace(/[\x00-\x1f<>:"/\\|?*]+/g, '') // control chars + path/url-hostile chars
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+$/, ''); // never allow a dots-only name like ".."
  return cleaned || 'file';
}

export function extOf(name: string): string {
  return path.extname(name).toLowerCase().replace(/^\./, '');
}

export function swapExt(name: string, newExt: string): string {
  const base = path.basename(name, path.extname(name));
  return `${base}.${newExt}`;
}
