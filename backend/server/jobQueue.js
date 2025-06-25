// backend/server/jobQueue.js
// Job queue setup using BullMQ for background processing

// --- REDIS/BullMQ DISABLED ---
// The code below is kept for future reintegration. All exports are now no-ops.
// To re-enable, restore the BullMQ/ioredis imports and logic, and update usage in routes and index.js.

// import pkg from 'bullmq';
// const { Queue, Worker, Job } = pkg;
// import IORedis from 'ioredis';
// import dotenv from 'dotenv';
// dotenv.config();

// const redisUrl = process.env.REDIS_URL;
// let blogJobQueue, addBlogJob, startBlogJobWorker;

// if (redisUrl) {
//   const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
//   blogJobQueue = new Queue('blog-publish', { connection });
//   addBlogJob = async (jobData) =>
//     blogJobQueue.add('publish', jobData, {
//       attempts: 3,
//       backoff: { type: 'exponential', delay: 10000 },
//       removeOnComplete: true,
//       removeOnFail: false,
//     });
//   startBlogJobWorker = (processJobFn) => {
//     const worker = new Worker(
//       'blog-publish',
//       async (job) => await processJobFn(job.data),
//       { connection }
//     );
//     worker.on('completed', (job) => {
//       console.log(`✅ Blog job ${job.id} completed.`);
//     });
//     worker.on('failed', (job, err) => {
//       console.error(`❌ Blog job ${job.id} failed:`, err);
//     });
//     return worker;
//   };
// } else {
//   // Dummy implementations to avoid Redis errors
//   blogJobQueue = null;
//   addBlogJob = async () => {
//     console.warn('Redis not configured: job not queued.');
//   };
//   startBlogJobWorker = () => {
//     console.warn('Redis not configured: worker not started.');
//   };
// }

// --- NO-OP IMPLEMENTATIONS ---
const blogJobQueue = null;
const addBlogJob = async (jobData) => {
  // Redis/BullMQ disabled: run synchronously if needed
  // (Call the service directly in the route instead)
  return Promise.resolve();
};
const startBlogJobWorker = () => {
  // Redis/BullMQ disabled: no worker started
  return null;
};

export { blogJobQueue, addBlogJob, startBlogJobWorker };
