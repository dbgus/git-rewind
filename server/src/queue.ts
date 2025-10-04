import EventEmitter from 'events';

export interface Job {
  id: string;
  type: 'fetch-commits' | 'fetch-all';
  data: any;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  result?: any;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

class JobQueue extends EventEmitter {
  private jobs: Map<string, Job> = new Map();
  private queue: string[] = [];
  private processing: boolean = false;
  private worker: ((job: Job) => Promise<any>) | null = null;

  constructor() {
    super();
  }

  // Set the worker function that processes jobs
  setWorker(worker: (job: Job) => Promise<any>) {
    this.worker = worker;
  }

  // Add a new job to the queue
  addJob(type: Job['type'], data: any): string {
    const jobId = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const job: Job = {
      id: jobId,
      type,
      data,
      status: 'pending',
      createdAt: new Date(),
    };

    this.jobs.set(jobId, job);
    this.queue.push(jobId);

    this.emit('job-added', job);

    // Start processing if not already running
    this.processNext();

    return jobId;
  }

  // Get job status
  getJob(jobId: string): Job | undefined {
    return this.jobs.get(jobId);
  }

  // Get all jobs
  getAllJobs(): Job[] {
    return Array.from(this.jobs.values());
  }

  // Get jobs by status
  getJobsByStatus(status: Job['status']): Job[] {
    return Array.from(this.jobs.values()).filter(job => job.status === status);
  }

  // Update job progress
  updateProgress(jobId: string, progress: number) {
    const job = this.jobs.get(jobId);
    if (job) {
      job.progress = progress;
      this.emit('job-progress', job);
    }
  }

  // Process next job in queue
  private async processNext() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;
    const jobId = this.queue.shift();

    if (!jobId) {
      this.processing = false;
      return;
    }

    const job = this.jobs.get(jobId);
    if (!job || !this.worker) {
      this.processing = false;
      this.processNext();
      return;
    }

    job.status = 'processing';
    job.startedAt = new Date();
    this.emit('job-started', job);

    try {
      const result = await this.worker(job);
      job.status = 'completed';
      job.result = result;
      job.completedAt = new Date();
      this.emit('job-completed', job);
    } catch (error: any) {
      job.status = 'failed';
      job.error = error.message || 'Unknown error';
      job.completedAt = new Date();
      this.emit('job-failed', job);
    }

    this.processing = false;

    // Process next job
    this.processNext();
  }

  // Clean up old completed/failed jobs (older than 1 hour)
  cleanupOldJobs() {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    for (const [jobId, job] of this.jobs.entries()) {
      if (
        (job.status === 'completed' || job.status === 'failed') &&
        job.completedAt &&
        job.completedAt < oneHourAgo
      ) {
        this.jobs.delete(jobId);
      }
    }
  }

  // Get queue statistics
  getStats() {
    const jobs = Array.from(this.jobs.values());
    return {
      total: jobs.length,
      pending: jobs.filter(j => j.status === 'pending').length,
      processing: jobs.filter(j => j.status === 'processing').length,
      completed: jobs.filter(j => j.status === 'completed').length,
      failed: jobs.filter(j => j.status === 'failed').length,
    };
  }
}

// Create singleton instance
export const jobQueue = new JobQueue();

// Clean up old jobs every 10 minutes
setInterval(() => {
  jobQueue.cleanupOldJobs();
}, 10 * 60 * 1000);
