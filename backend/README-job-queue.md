// backend/README-job-queue.md

# Job Queue Integration (BullMQ)

This backend uses [BullMQ](https://docs.bullmq.io/) for job queueing to handle heavy or long-running blog publishing tasks.

## How it works
- API requests to generate/publish a blog are queued as jobs (see `server/routes/blogController.js`).
- Jobs are processed in the background by a BullMQ worker (see `server/index.js`).
- The worker calls the main service logic (`generateAndPublishService`).
- This prevents resource exhaustion and allows for scaling and reliability.

## Requirements
- **Redis** must be running (default: `redis://localhost:6379`).
  - You can set `REDIS_URL` in your `.env` file if needed.
- Install dependencies:
  ```sh
  npm install bullmq ioredis
  ```

## Files
- `server/jobQueue.js`: Queue and worker setup.
- `server/routes/blogController.js`: API now queues jobs instead of running them immediately.
- `server/index.js`: Starts the BullMQ worker.

## Customization
- You can add more queues or job types as needed.
- For advanced concurrency, see [Puppeteer Cluster](https://github.com/thomasdondorf/puppeteer-cluster).

---
