import { webcrypto as crypto } from 'node:crypto';
if (!globalThis.crypto) {
  globalThis.crypto = crypto;
}
import cron from 'node-cron';
import { generateAndPublish } from '../controllers/blogGeneratorController.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function startBlogScheduler() {
  cron.schedule('* * * * *', async () => {
    const scanStart = new Date();
    console.log(`[${scanStart.toISOString()}] 🕒 Scheduler scan started`);
    try {
      const now = new Date();
      const configs = await prisma.blogConfig.findMany({
        where: {
          OR: [
            { hasRun: false },
            { scheduleTime: { lte: now } },
          ],
        },
      });
      console.log(`[${new Date().toISOString()}] Found ${configs.length} configs to process`);
      for (let index = 0; index < configs.length; index++) {
        const config = configs[index];
        console.log(`[${new Date().toISOString()}] Processing config ID: ${config.id || `config-${index + 1}`}`);
        const configId = config.id || `config-${index + 1}`;
        const exhaustAllKeywords = config.exhaustAllKeywords !== false;
        let shouldRun = false;

        // --- Scheduling Logic ---
        if (config.hasRun) continue;
        if (config.status === 'running') {
          const interval = config.publishIntervalMinutes || 10;
          const startedAt = config.startedAt ? new Date(config.startedAt) : null;
          const maxStuckMs = interval * 2 * 60000;
          if (startedAt && (now - startedAt > maxStuckMs)) {
            await prisma.blogConfig.update({ where: { id: config.id }, data: { status: 'pending', startedAt: null } });
          } else {
            continue;
          }
        }
        const interval = config.publishIntervalMinutes;
        const lastPublished = config.lastPublishedAt;
        if (exhaustAllKeywords) {
          if (interval && interval > 0) {
            if (!lastPublished) {
              shouldRun = true;
            } else {
              const nextTime = new Date(lastPublished.getTime() + interval * 60000);
              shouldRun = now >= nextTime;
            }
          } else {
            shouldRun = true;
          }
        } else {
          const hasSchedule = !!config.scheduleTime;
          const scheduledTime = hasSchedule ? new Date(config.scheduleTime) : null;
          if (!hasSchedule) {
            shouldRun = true;
          } else if (!isNaN(scheduledTime)) {
            const diff = Math.abs(scheduledTime - now);
            shouldRun = diff < 60 * 1000;
          }
        }

        // --- Keyword Publishing Logic ---
        const unpublishedKeywords = await prisma.keyword.findMany({ where: { published: false } });
        const allKeywords = await prisma.keyword.findMany();
        if (unpublishedKeywords.length === 0) {
          if (!config.hasRun && allKeywords.length > 0) {
            await prisma.blogConfig.update({ where: { id: config.id }, data: { hasRun: true, status: 'finished', finishedAt: new Date() } });
          }
          continue;
        }

        let keywordsToPublish = [];
        let keywordsToMarkPublished = [];
        let inArticleKeywords = [];
        if (config.inArticleKeywords) {
          try {
            let parsed;
            if (Array.isArray(config.inArticleKeywords)) {
              parsed = config.inArticleKeywords;
            } else if (typeof config.inArticleKeywords === 'string') {
              if (config.inArticleKeywords.trim().startsWith('[')) {
                parsed = JSON.parse(config.inArticleKeywords);
              } else {
                parsed = config.inArticleKeywords.split(',').map(k => k.trim()).filter(Boolean);
              }
            }
            if (Array.isArray(parsed)) {
              inArticleKeywords = exhaustAllKeywords ? parsed : parsed.slice(0, 3);
            }
          } catch {}
        }
        if (exhaustAllKeywords) {
          keywordsToPublish = unpublishedKeywords.map(k => k.keyword);
          keywordsToMarkPublished = [...keywordsToPublish];
        } else {
          keywordsToPublish = [unpublishedKeywords[0].keyword];
          keywordsToMarkPublished = [unpublishedKeywords[0].keyword];
        }
        if (inArticleKeywords.length === 0 && config.keywordsPerArticle && keywordsToPublish.length > 0) {
          inArticleKeywords = unpublishedKeywords
            .filter(k => !keywordsToPublish.includes(k.keyword))
            .slice(0, config.keywordsPerArticle * keywordsToPublish.length)
            .map(k => k.keyword)
            .slice(0, 3);
        }
        keywordsToMarkPublished.push(...inArticleKeywords);
        keywordsToMarkPublished = [...new Set(keywordsToMarkPublished)];

        if (shouldRun) {
          await prisma.blogConfig.update({ where: { id: config.id }, data: { status: 'running', startedAt: new Date() } });
          let processingLog = config.processingLog || [];
          try {
            // Modularized: Call publishing logic for each keyword/site
            const sanitizedConfig = {
              ...config,
              sites: typeof config.sites === 'string' ? JSON.parse(config.sites) : config.sites,
              links: typeof config.links === 'string' ? JSON.parse(config.links) : config.links,
              tags: typeof config.tags === 'string' ? JSON.parse(config.tags) : config.tags,
              topics: typeof config.topics === 'string' ? JSON.parse(config.topics) : config.topics,
              autoTitle: config.autoTitle !== false,
              contentSource: config.contentSource || 'openai',
              engine: config.engine || undefined,
            };
            let sites = Array.isArray(sanitizedConfig.sites) ? sanitizedConfig.sites : (sanitizedConfig.sites ? [sanitizedConfig.sites] : []);
            sites = sites.filter(s => s.publishingAvailable !== false);
            if (sites.length === 0) {
              await prisma.siteConfig.updateMany({ data: { publishingAvailable: true } });
              sites = Array.isArray(sanitizedConfig.sites) ? sanitizedConfig.sites : (sanitizedConfig.sites ? [sanitizedConfig.sites] : []);
              sites = sites.filter(s => s.publishingAvailable !== false);
            }
            let siteCount = sites.length;
            let startSiteIndex = (typeof config.lastSiteIndex === 'number' && siteCount > 0)
              ? (config.lastSiteIndex + 1) % siteCount
              : 0;
            for (let i = 0; i < keywordsToPublish.length; i++) {
              const keyword = keywordsToPublish[i];
              let link = '';
              const siteIndex = (startSiteIndex + i) % siteCount;
              const site = siteCount > 0 ? sites[siteIndex] : null;
              if (Array.isArray(sanitizedConfig.links) && sanitizedConfig.links.length > 0 && Array.isArray(sanitizedConfig.keywords)) {
                const keywordIndex = sanitizedConfig.keywords.findIndex(k => k === keyword);
                if (keywordIndex !== -1 && sanitizedConfig.links[keywordIndex]) {
                  link = sanitizedConfig.links[keywordIndex];
                } else {
                  link = sanitizedConfig.links[0];
                }
              } else if (Array.isArray(sanitizedConfig.links) && sanitizedConfig.links.length > 0) {
                link = sanitizedConfig.links[0];
              }
              const payload = {
                ...sanitizedConfig,
                sites: [site],
                publishingKeyword: keyword,
                inArticleKeywords: inArticleKeywords.filter(k => k !== keyword),
                link,
                contentSource: sanitizedConfig.contentSource,
                engine: sanitizedConfig.engine,
                blogConfigId: config.id,
                links: sanitizedConfig.links || [],
              };
              await generateAndPublish(
                { body: payload },
                {
                  json: (data) => {
                    processingLog.push({ timestamp: new Date().toISOString(), event: 'publish', data });
                  },
                  status: (code) => ({
                    json: (payload) => {
                      processingLog.push({ timestamp: new Date().toISOString(), event: 'status', code, payload });
                    },
                  }),
                }
              );

              // Immediately mark this keyword as published before moving to the next
              await prisma.keyword.updateMany({
                where: { keyword },
                data: { published: true, publishedAt: new Date() }
              });

              await prisma.siteConfig.updateMany({ where: { url: site.url, username: site.username }, data: { publishingAvailable: false } });
              await prisma.blogConfig.update({ where: { id: config.id }, data: { lastSiteIndex: siteIndex } });
            }
            // Only mark as published if config.keywords is not set (i.e., not pre-assigned)
            if (!config.keywords || config.keywords.length === 0) {
              await prisma.keyword.updateMany({
                where: { keyword: { in: keywordsToMarkPublished } },
                data: { published: true, publishedAt: new Date() }
              });
            }
            await prisma.blogConfig.update({ where: { id: config.id }, data: { lastPublishedAt: now } });
            const unpublishedCount = await prisma.keyword.count({ where: { published: false } });
            if (config.scheduleTime) {
              await prisma.blogConfig.update({ where: { id: config.id }, data: { hasRun: true, status: 'finished', finishedAt: new Date(), processingLog } });
            } else if (unpublishedCount === 0) {
              await prisma.blogConfig.update({ where: { id: config.id }, data: { hasRun: true, status: 'finished', finishedAt: new Date(), processingLog } });
            } else {
              await prisma.blogConfig.update({ where: { id: config.id }, data: { status: 'pending', processingLog } });
            }
          } catch (err) {
            processingLog.push({ timestamp: new Date().toISOString(), event: 'error', error: err.message });
            await prisma.blogConfig.update({ where: { id: config.id }, data: { status: 'error', finishedAt: new Date(), processingLog } });
          }
        }
      }
      console.log(`[${new Date().toISOString()}] Scheduler scan finished`);
    } catch (err) {
      console.error(`[${new Date().toISOString()}] ❌ Scheduler error:`, err.message);
    }
  });
  console.log('🕒 Blog scheduler running every minute...');
}
