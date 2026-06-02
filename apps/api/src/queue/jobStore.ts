import { Job, JobStatus, JobProgress } from '../types.js';

/**
 * In-memory job registry. Single source of truth for job state.
 * For a multi-worker deployment this is the seam to swap for Redis/Postgres.
 */
class JobStore {
  private jobs = new Map<string, Job>();

  create(job: Job): Job {
    this.jobs.set(job.id, job);
    return job;
  }

  get(id: string): Job | undefined {
    return this.jobs.get(id);
  }

  update(id: string, patch: Partial<Job>): Job | undefined {
    const job = this.jobs.get(id);
    if (!job) return undefined;
    Object.assign(job, patch, { updatedAt: Date.now() });
    return job;
  }

  setStatus(id: string, status: JobStatus, progress?: Partial<JobProgress>): void {
    const job = this.jobs.get(id);
    if (!job) return;
    job.status = status;
    if (progress) job.progress = { ...job.progress, ...progress };
    job.updatedAt = Date.now();
  }

  delete(id: string): void {
    this.jobs.delete(id);
  }

  all(): Job[] {
    return [...this.jobs.values()];
  }
}

export const jobStore = new JobStore();
