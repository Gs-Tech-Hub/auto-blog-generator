// backend/server/jobQueue.js
// Job queue setup using BullMQ for background processing

import pkg from 'bullmq';
const { Queue, Worker, Job } = pkg;
import IORedis from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

// Create a queue for blog publishing jobs
export const blogJobQueue = new Queue('blog-publish', { connection });

// Add a job to the queue
export async function addBlogJob(jobData) {
  return blogJobQueue.add('publish', jobData, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 10000 },
    removeOnComplete: true,
    removeOnFail: false,
  });
}

// Worker to process jobs (should be started in a separate process for scale)
export function startBlogJobWorker(processJobFn) {
  const worker = new Worker(
    'blog-publish',
    async (job) => {
      return await processJobFn(job.data);
    },
    { connection }
  );
  worker.on('completed', (job) => {
    console.log(`✅ Blog job ${job.id} completed.`);
  });
  worker.on('failed', (job, err) => {
    console.error(`❌ Blog job ${job.id} failed:`, err);
  });
  return worker;
}
