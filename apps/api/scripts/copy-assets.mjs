// Copies non-TS runtime assets (the Blender bridge script) into dist/ after tsc.
import { cp, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url)); // apps/api/scripts
const apiRoot = path.resolve(root, '..');

const src = path.join(apiRoot, 'src', 'scripts');
const dest = path.join(apiRoot, 'dist', 'scripts');

await mkdir(dest, { recursive: true });
await cp(src, dest, { recursive: true });
console.log(`Copied runtime scripts -> ${path.relative(apiRoot, dest)}`);
