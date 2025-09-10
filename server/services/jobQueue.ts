import pLimit from 'p-limit';

interface Job {
  id: string;
  type: string;
  data: any;
  retries: number;
  maxRetries: number;
  createdAt: Date;
}

export class JobQueue {
  private jobs: Map<string, Job> = new Map();
  private processing = false;
  private limit = pLimit(3); // Max 3 concurrent AI calls
  private listeners: Map<string, (job: Job) => Promise<void>> = new Map();

  constructor() {
    // Start processing jobs every few seconds
    setInterval(() => this.processJobs(), 2000);
  }

  /**
   * Add a job to the queue
   */
  enqueue(type: string, data: any, maxRetries: number = 2): string {
    const jobId = `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const job: Job = {
      id: jobId,
      type,
      data,
      retries: 0,
      maxRetries,
      createdAt: new Date()
    };
    
    this.jobs.set(jobId, job);
    console.log(`📋 Enqueued job ${jobId} of type ${type}`);
    return jobId;
  }

  /**
   * Register a job handler
   */
  addHandler(type: string, handler: (job: Job) => Promise<void>) {
    this.listeners.set(type, handler);
  }

  /**
   * Process pending jobs with concurrency control
   */
  private async processJobs() {
    if (this.processing || this.jobs.size === 0) {
      return;
    }

    this.processing = true;
    const pendingJobs = Array.from(this.jobs.values());
    
    try {
      // Process jobs with concurrency limit
      await Promise.allSettled(
        pendingJobs.map(job => 
          this.limit(() => this.processJob(job))
        )
      );
    } catch (error) {
      console.error('Error processing job batch:', error);
    } finally {
      this.processing = false;
    }
  }

  /**
   * Process a single job with timeout and retry logic
   */
  private async processJob(job: Job): Promise<void> {
    const handler = this.listeners.get(job.type);
    if (!handler) {
      console.warn(`No handler found for job type: ${job.type}`);
      this.jobs.delete(job.id);
      return;
    }

    try {
      // Add timeout to prevent hanging jobs
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Job timeout')), 30000)
      );
      
      await Promise.race([handler(job), timeoutPromise]);
      
      // Job completed successfully
      this.jobs.delete(job.id);
      console.log(`✅ Completed job ${job.id}`);
      
    } catch (error) {
      console.error(`❌ Job ${job.id} failed:`, error);
      
      job.retries++;
      if (job.retries >= job.maxRetries) {
        console.error(`💀 Job ${job.id} exceeded max retries, removing`);
        this.jobs.delete(job.id);
      } else {
        console.log(`🔄 Retrying job ${job.id} (attempt ${job.retries + 1}/${job.maxRetries})`);
      }
    }
  }

  /**
   * Get queue status for monitoring
   */
  getStatus() {
    return {
      queueSize: this.jobs.size,
      processing: this.processing,
      jobs: Array.from(this.jobs.values()).map(job => ({
        id: job.id,
        type: job.type,
        retries: job.retries,
        age: Date.now() - job.createdAt.getTime()
      }))
    };
  }
}

// Singleton instance
export const jobQueue = new JobQueue();