import { WorkerQueue } from '../queue/queue.js';
import { config } from '../config.js';
import { runConversion } from './conversionService.js';

/** Process-wide conversion queue. */
export const conversionQueue = new WorkerQueue(config.maxConcurrentJobs);

export function submitJob(jobId: string): void {
  conversionQueue.enqueue(jobId, () => runConversion(jobId));
}
