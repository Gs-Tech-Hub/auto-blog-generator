import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';

import configRoutes from './routes/configController.js';
import authRoutes, { requireAuth } from './routes/auth.js';
import blogRoutes from './routes/blogController.js';
import { startBlogScheduler } from './scheduler/blogScheduler.js';
import { registerGlobalHandlers } from './globalHandlers.js';
import { closeLastBrowser } from '../models/scrappers/scrapperBot.js';
import { startBlogJobWorker } from './jobQueue.js';
import { generateAndPublishService } from './services/blogGeneratorService.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));

startBlogScheduler(app);

// Modularized route usage
app.use('/api/auth', authRoutes);

// Protect all /api routes except /api/auth/*
app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/auth/')) return next();
  return requireAuth(req, res, next);
});

app.use('/api', configRoutes);
app.use('/api', blogRoutes);

// Register global process handlers for errors and exit
registerGlobalHandlers({
  onExit: async () => {
    await closeLastBrowser();
  },
});

// Start BullMQ worker for blog jobs
startBlogJobWorker(generateAndPublishService);

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
