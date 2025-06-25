// backend/server/jobQueue.js
// Job queue setup using BullMQ for background processing

import pkg from 'bullmq';
const { Queue, Worker, Job } = pkg;
import IORedis from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();

// If REDIS_URL is not set, use a dummy queue/worker to avoid errors in dev
const redisUrl = process.env.REDIS_URL;
let blogJobQueue, addBlogJob, startBlogJobWorker;

if (redisUrl) {
  const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
  blogJobQueue = new Queue('blog-publish', { connection });
  addBlogJob = async (jobData) =>
    blogJobQueue.add('publish', jobData, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 10000 },
      removeOnComplete: true,
      removeOnFail: false,
    });
  startBlogJobWorker = (processJobFn) => {
    const worker = new Worker(
      'blog-publish',
      async (job) => await processJobFn(job.data),
      { connection }
    );
    worker.on('completed', (job) => {
      console.log(`✅ Blog job ${job.id} completed.`);
    });
    worker.on('failed', (job, err) => {
      console.error(`❌ Blog job ${job.id} failed:`, err);
    });
    return worker;
  };
} else {
  // Dummy implementations to avoid Redis errors
  blogJobQueue = null;
  addBlogJob = async () => {
    console.warn('Redis not configured: job not queued.');
  };
  startBlogJobWorker = () => {
    console.warn('Redis not configured: worker not started.');
  };
}

export { blogJobQueue, addBlogJob, startBlogJobWorker };
