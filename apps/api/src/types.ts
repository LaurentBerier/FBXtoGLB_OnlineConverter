import type { OptimizeOptions } from './converters/optimizeGlb.js';

export type Direction = 'fbx2glb' | 'glb2fbx';
export type OutputUpAxis = 'y' | 'z';

export interface CompressionStats {
  beforeBytes: number;
  afterBytes: number;
}

export type JobStatus =
  | 'queued'
  | 'validating'
  | 'converting'
  | 'verifying'
  | 'packaging'
  | 'done'
  | 'error';

export interface JobProgress {
  /** 0..100 */
  percent: number;
  /** Human readable current step */
  label: string;
}

/** A single line in the conversion report. */
export interface ReportCheck {
  key: string;
  label: string;
  /** ok = preserved, warn = partial/unverifiable, fail = lost */
  status: 'ok' | 'warn' | 'fail';
  /** e.g. "12/12 preserved" */
  detail: string;
  source?: number;
  output?: number;
}

export interface ConversionReport {
  direction: Direction;
  inputName: string;
  outputName: string;
  generatedAt: string;
  /** Overall verdict derived from checks. */
  verdict: 'pass' | 'pass-with-warnings' | 'fail';
  checks: ReportCheck[];
  /** Free-form notes from the converter/validator (engine versions, warnings). */
  notes: string[];
}

export interface Job {
  id: string;
  direction: Direction;
  status: JobStatus;
  progress: JobProgress;
  inputName: string;
  inputPath: string;
  inputSize: number;
  options: OptimizeOptions;
  outputUpAxis: OutputUpAxis;
  outputName?: string;
  outputPath?: string;
  outputSize?: number;
  compression?: CompressionStats;
  report?: ConversionReport;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

/** Public, serialisable view of a job (no absolute paths). */
export interface JobView {
  id: string;
  direction: Direction;
  status: JobStatus;
  progress: JobProgress;
  inputName: string;
  options: OptimizeOptions;
  outputName?: string;
  outputSize?: number;
  compression?: CompressionStats;
  report?: ConversionReport;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

export function toJobView(job: Job): JobView {
  return {
    id: job.id,
    direction: job.direction,
    status: job.status,
    progress: job.progress,
    inputName: job.inputName,
    options: job.options,
    outputName: job.outputName,
    outputSize: job.outputSize,
    compression: job.compression,
    report: job.report,
    error: job.error,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}
