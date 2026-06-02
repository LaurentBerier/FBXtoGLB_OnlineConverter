import multer from 'multer';
import path from 'node:path';
import { nanoid } from 'nanoid';
import { config } from '../config.js';
import { extOf } from '../util/files.js';

const ALLOWED = new Set(['fbx', 'glb', 'gltf']);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, config.uploadsDir),
  filename: (_req, file, cb) => {
    // Random staging name; the route relocates it into a per-job dir afterward.
    const ext = extOf(file.originalname) || 'bin';
    cb(null, `${nanoid()}.${ext}`);
  },
});

export const uploadSingle = multer({
  storage,
  limits: {
    fileSize: config.maxFileSizeBytes,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    const ext = extOf(file.originalname);
    if (!ALLOWED.has(ext)) {
      cb(new Error(`Unsupported file type ".${ext}". Allowed: .fbx, .glb, .gltf`));
      return;
    }
    cb(null, true);
  },
}).single('file');

export function isUploadExtAllowed(name: string): boolean {
  return ALLOWED.has(path.extname(name).toLowerCase().replace(/^\./, ''));
}
