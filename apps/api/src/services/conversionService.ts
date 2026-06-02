import path from 'node:path';
import { config } from '../config.js';
import { Job } from '../types.js';
import { jobStore } from '../queue/jobStore.js';
import { logger } from '../util/logger.js';
import { fileSize, swapExt } from '../util/files.js';
import { convertFbxToGlb } from '../converters/fbx2glb.js';
import { convertGlbToFbx } from '../converters/glb2fbx.js';
import { inspectFbx } from '../validation/fbxInspect.js';
import { inspectGlb } from '../validation/gltfInspect.js';
import { buildReport } from '../validation/report.js';
import { AssetSummary, emptySummary } from '../validation/summary.js';

const log = logger.child('pipeline');

/**
 * Full conversion pipeline for one job:
 *   validate -> inspect source -> convert -> inspect output -> verify -> report.
 * Progress is pushed into the job store so the status endpoint can stream it.
 */
export async function runConversion(jobId: string): Promise<void> {
  const job = jobStore.get(jobId);
  if (!job) return;

  try {
    const jobDir = path.dirname(job.inputPath);
    const outputName =
      job.direction === 'fbx2glb' ? swapExt(job.inputName, 'glb') : swapExt(job.inputName, 'fbx');
    const outputPath = path.join(jobDir, outputName);

    // 1. Inspect the source so we have something to validate against.
    jobStore.setStatus(jobId, 'validating', { percent: 8, label: 'Inspecting source file' });
    const source = await inspectSource(job);

    // 2. Run the engine.
    jobStore.setStatus(jobId, 'converting', { percent: 30, label: 'Converting with engine' });
    const onLog = (line: string) => log.debug(`[${jobId}] ${line}`);
    const result =
      job.direction === 'fbx2glb'
        ? await convertFbxToGlb(job.inputPath, outputPath, onLog)
        : await convertGlbToFbx(job.inputPath, outputPath, onLog);

    // 3. Inspect the output.
    jobStore.setStatus(jobId, 'verifying', { percent: 72, label: 'Verifying skeleton, skinning & animation' });
    const output = await inspectOutput(job.direction, result.outputPath);

    // 4. Build the validation report.
    jobStore.setStatus(jobId, 'packaging', { percent: 90, label: 'Generating conversion report' });
    const report = buildReport(
      job.direction,
      job.inputName,
      path.basename(result.outputPath),
      source,
      output,
      result.notes,
    );

    const outSize = await fileSize(result.outputPath);
    jobStore.update(jobId, {
      status: 'done',
      progress: { percent: 100, label: 'Done' },
      outputName: path.basename(result.outputPath),
      outputPath: result.outputPath,
      outputSize: outSize,
      report,
    });
    log.info(`job ${jobId} done -> ${path.basename(result.outputPath)} (${report.verdict})`);
  } catch (err) {
    const message = (err as Error).message || 'Conversion failed';
    log.error(`job ${jobId} failed`, message);
    jobStore.update(jobId, {
      status: 'error',
      progress: { percent: 100, label: 'Failed' },
      error: message,
    });
  }
}

async function inspectSource(job: Job): Promise<AssetSummary> {
  try {
    return job.direction === 'fbx2glb'
      ? await inspectFbx(job.inputPath)
      : await inspectGlb(job.inputPath);
  } catch (err) {
    const s = emptySummary();
    s.notes.push(`Source inspection skipped: ${(err as Error).message}`);
    return s;
  }
}

async function inspectOutput(direction: Job['direction'], outputPath: string): Promise<AssetSummary> {
  try {
    return direction === 'fbx2glb' ? await inspectGlb(outputPath) : await inspectFbx(outputPath);
  } catch (err) {
    const s = emptySummary();
    s.notes.push(`Output inspection skipped: ${(err as Error).message}`);
    return s;
  }
}

export const pipelineConfig = { maxConcurrent: config.maxConcurrentJobs };
