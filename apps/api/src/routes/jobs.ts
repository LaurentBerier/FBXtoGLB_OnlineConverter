import { Router, Request, Response } from 'express';
import { jobStore } from '../queue/jobStore.js';
import { toJobView } from '../types.js';
import { pathExists } from '../util/files.js';

export const jobsRouter = Router();

/** Poll job status + progress + report. */
jobsRouter.get('/jobs/:id', (req: Request, res: Response) => {
  const job = jobStore.get(req.params.id);
  if (!job) {
    res.status(404).json({ error: 'Job not found or expired.' });
    return;
  }
  res.json({ job: toJobView(job) });
});

/** Download the converted artifact once the job is done. */
jobsRouter.get('/jobs/:id/download', async (req: Request, res: Response) => {
  const job = jobStore.get(req.params.id);
  if (!job) {
    res.status(404).json({ error: 'Job not found or expired.' });
    return;
  }
  if (job.status !== 'done' || !job.outputPath) {
    res.status(409).json({ error: `Job is not ready (status: ${job.status}).` });
    return;
  }
  if (!(await pathExists(job.outputPath))) {
    res.status(410).json({ error: 'Converted file no longer available (expired).' });
    return;
  }
  res.download(job.outputPath, job.outputName || 'converted', (err) => {
    if (err && !res.headersSent) res.status(500).json({ error: 'Download failed.' });
  });
});

/** Fetch just the validation report as JSON. */
jobsRouter.get('/jobs/:id/report', (req: Request, res: Response) => {
  const job = jobStore.get(req.params.id);
  if (!job?.report) {
    res.status(404).json({ error: 'Report not available.' });
    return;
  }
  res.json({ report: job.report });
});
