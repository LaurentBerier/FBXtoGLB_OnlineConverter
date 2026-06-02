export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') || 'http://localhost:4000';

export type Direction = 'fbx2glb' | 'glb2fbx';

export type JobStatus =
  | 'queued'
  | 'validating'
  | 'converting'
  | 'verifying'
  | 'packaging'
  | 'done'
  | 'error';

export interface ReportCheck {
  key: string;
  label: string;
  status: 'ok' | 'warn' | 'fail';
  detail: string;
  source?: number;
  output?: number;
}

export interface ConversionReport {
  direction: Direction;
  inputName: string;
  outputName: string;
  generatedAt: string;
  verdict: 'pass' | 'pass-with-warnings' | 'fail';
  checks: ReportCheck[];
  notes: string[];
}

export interface JobView {
  id: string;
  direction: Direction;
  status: JobStatus;
  progress: { percent: number; label: string };
  inputName: string;
  outputName?: string;
  outputSize?: number;
  report?: ConversionReport;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Capabilities {
  limits: { maxFileSizeMb: number; retentionHours: number };
  queue: { running: number; depth: number };
  engines: {
    fbx2gltf: { available: boolean; version: string | null };
    blender: { available: boolean; version: string | null };
  };
  directions: { fbx2glb: boolean; glb2fbx: boolean };
}

async function asError(res: Response): Promise<never> {
  let message = `Request failed (${res.status})`;
  try {
    const body = await res.json();
    if (body?.error) message = body.error;
  } catch {
    /* ignore */
  }
  throw new Error(message);
}

export async function fetchCapabilities(): Promise<Capabilities> {
  const res = await fetch(`${API_BASE}/api/capabilities`, { cache: 'no-store' });
  if (!res.ok) await asError(res);
  return res.json();
}

export async function startConversion(
  file: File,
  direction: Direction,
  onUploadProgress?: (percent: number) => void,
): Promise<JobView> {
  // XHR so we can report upload progress (fetch can't, pre-streams).
  return new Promise<JobView>((resolve, reject) => {
    const form = new FormData();
    form.append('direction', direction);
    form.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}/api/convert`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onUploadProgress) {
        onUploadProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      try {
        const body = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) resolve(body.job as JobView);
        else reject(new Error(body?.error || `Upload failed (${xhr.status})`));
      } catch {
        reject(new Error(`Unexpected response (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error('Network error during upload.'));
    xhr.send(form);
  });
}

export async function fetchJob(id: string): Promise<JobView> {
  const res = await fetch(`${API_BASE}/api/jobs/${id}`, { cache: 'no-store' });
  if (!res.ok) await asError(res);
  const body = await res.json();
  return body.job as JobView;
}

export function downloadUrl(id: string): string {
  return `${API_BASE}/api/jobs/${id}/download`;
}
