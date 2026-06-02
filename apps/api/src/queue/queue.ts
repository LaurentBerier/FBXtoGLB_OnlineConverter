import { logger } from '../util/logger.js';

const log = logger.child('queue');

type Task = () => Promise<void>;

interface QueueItem {
  id: string;
  task: Task;
}

/**
 * Minimal concurrency-limited FIFO queue. Runs up to `concurrency` tasks at
 * once; the rest wait. Drop-in seam for BullMQ/Redis in a clustered deployment.
 */
export class WorkerQueue {
  private readonly concurrency: number;
  private active = 0;
  private readonly pending: QueueItem[] = [];

  constructor(concurrency: number) {
    this.concurrency = Math.max(1, concurrency);
  }

  get depth(): number {
    return this.pending.length;
  }

  get running(): number {
    return this.active;
  }

  enqueue(id: string, task: Task): void {
    this.pending.push({ id, task });
    log.debug(`enqueued ${id} (depth=${this.pending.length}, active=${this.active})`);
    this.drain();
  }

  private drain(): void {
    while (this.active < this.concurrency && this.pending.length > 0) {
      const item = this.pending.shift()!;
      this.active++;
      log.debug(`starting ${item.id} (active=${this.active})`);
      void item
        .task()
        .catch((err) => log.error(`task ${item.id} threw`, (err as Error).message))
        .finally(() => {
          this.active--;
          this.drain();
        });
    }
  }
}
