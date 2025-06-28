// Logging utility for consistent timestamps
const log = (...args) => console.log(`[${new Date().toISOString()}]`, ...args);

// Helper to parse JSON fields or comma-separated strings
function parseJSONField(field) {
  if (Array.isArray(field)) return field;
  if (typeof field === 'string') {
    try {
      return JSON.parse(field);
    } catch {
      return field.split(',').map(f => f.trim()).filter(Boolean);
    }
  }
  return [];
}

import { webcrypto as crypto } from 'node:crypto';
if (!globalThis.crypto) {
  globalThis.crypto = crypto;
}
import cron from 'node-cron';
import { generateAndPublish } from '../routes/blogController.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export function startBlogScheduler() {
  cron.schedule('* * * * *', async () => {
    const scanStart = new Date();
    log('🕒 Scheduler scan started');
    try {
      const now = new Date();
      // Only fetch configs where hasRun is false
      const configs = await prisma.blogConfig.findMany({
        where: {
          hasRun: false,
          OR: [
            { scheduleTime: { lte: now } },
            { scheduleTime: null }
          ],
        },
      });
      log(`Found ${configs.length} configs to process (hasRun: false)`);
      for (let index = 0; index < configs.length; index++) {
        const config = configs[index];
        log(`Processing config ID: ${config.id || `config-${index + 1}`}`);
        const configId = config.id || `config-${index + 1}`;
        const exhaustAllKeywords = config.exhaustAllKeywords !== false;
        let shouldRun = false;

        // --- Scheduling Logic ---
        if (config.hasRun) {
          log(`Skipping config ID: ${config.id} — hasRun=true`);
          continue;
        }
        if (config.status === 'running') {
          const interval = config.publishIntervalMinutes || 10;
          const startedAt = config.startedAt ? new Date(config.startedAt) : null;
          const maxStuckMs = interval * 2 * 60000;
          if (!startedAt || (now - startedAt > maxStuckMs)) {
            console.warn(`[${new Date().toISOString()}] BlogConfig ID ${config.id} was stuck in 'running' for over ${maxStuckMs/60000} minutes or startedAt was null. Resetting to 'pending'.`);
            await prisma.blogConfig.update({ where: { id: config.id }, data: { status: 'pending', startedAt: null } });
          } else {
            log(`Skipping config ID: ${config.id} — status=running, not stuck. startedAt: ${startedAt ? startedAt.toISOString() : 'null'}, now: ${now.toISOString()}, maxStuckMs: ${maxStuckMs}`);
            continue;
          }
        }
        const interval = config.publishIntervalMinutes;
        const lastPublished = config.lastPublishedAt;
        if (exhaustAllKeywords) {
          if (interval && interval > 0) {
            if (!lastPublished) {
              shouldRun = true;
              log(`Interval config. No lastPublishedAt, shouldRun: true`);
            } else {
              const nextTime = new Date(lastPublished.getTime() + interval * 60000);
              log(`Interval config. Last published: ${lastPublished.toISOString()}, nextTime: ${nextTime.toISOString()}, now: ${now.toISOString()}`);
              shouldRun = now >= nextTime;
            }
          } else {
            shouldRun = true;
            log(`Interval config. No interval set, shouldRun: true`);
          }
        } else {
          const hasSchedule = !!config.scheduleTime;
          const scheduledTime = hasSchedule ? new Date(config.scheduleTime) : null;
          if (!hasSchedule) {
            shouldRun = true;
            log(`Schedule config. No scheduleTime, shouldRun: true`);
          } else if (!isNaN(scheduledTime)) {
            const diff = Math.abs(scheduledTime - now);
            shouldRun = diff < 60 * 1000;
            log(`Schedule config. scheduleTime: ${scheduledTime?.toISOString()}, now: ${now.toISOString()}, diff(ms): ${diff}, shouldRun: ${shouldRun}`);
          }
        }

        if (!shouldRun) {
          log(`Skipping config ID: ${config.id}, status: ${config.status}, hasRun: ${config.hasRun}, shouldRun: ${shouldRun}, interval: ${interval}, lastPublishedAt: ${lastPublished ? lastPublished.toISOString() : 'null'}, scheduleTime: ${config.scheduleTime ? new Date(config.scheduleTime).toISOString() : 'null'}`);
          continue;
        }

        // --- Keyword Publishing Logic ---
        // Only publish one keyword per interval
        const unpublishedKeywords = await prisma.keyword.findMany({ where: { published: false, userId: config.userId } });
        const allKeywords = await prisma.keyword.findMany({ where: { userId: config.userId } });
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
            let parsed = parseJSONField(config.inArticleKeywords);
            if (Array.isArray(parsed)) {
              inArticleKeywords = exhaustAllKeywords ? parsed : parsed.slice(0, 3);
            }
          } catch {}
        }
        // Only publish one keyword per interval
        if (exhaustAllKeywords) {
          keywordsToPublish = [unpublishedKeywords[0].keyword];
          keywordsToMarkPublished = [unpublishedKeywords[0].keyword];
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
              sites: parseJSONField(config.sites),
              links: parseJSONField(config.links),
              tags: parseJSONField(config.tags),
              topics: parseJSONField(config.topics),
              autoTitle: config.autoTitle !== false,
              contentSource: config.contentSource || 'openai',
              engine: config.engine || undefined,
            };
            let sites = Array.isArray(sanitizedConfig.sites) ? sanitizedConfig.sites : (sanitizedConfig.sites ? [sanitizedConfig.sites] : []);
            sites = sites.filter(s => s.publishingAvailable !== false);
            if (sites.length === 0) {
              // Only reset sites that have been unavailable for >10 minutes
              await prisma.siteConfig.updateMany({
                where: { publishingAvailable: false, updatedAt: { lt: new Date(Date.now() - 10 * 60000) } },
                data: { publishingAvailable: true },
              });
              sites = Array.isArray(sanitizedConfig.sites) ? sanitizedConfig.sites : (sanitizedConfig.sites ? [sanitizedConfig.sites] : []);
              sites = sites.filter(s => s.publishingAvailable !== false);
            }
            let siteCount = sites.length;
            let startSiteIndex = (typeof config.lastSiteIndex === 'number' && siteCount > 0)
              ? (config.lastSiteIndex + 1) % siteCount
              : 0;
            // Only publish one keyword per interval
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
              // Per-keyword error handling
              try {
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
                // Strictly update lastPublishedAt after each publish
                await prisma.blogConfig.update({ where: { id: config.id }, data: { lastPublishedAt: new Date() } });
              } catch (err) {
                processingLog.push({ timestamp: new Date().toISOString(), event: 'error-keyword', keyword, error: err.message });
                log(`Error publishing keyword '${keyword}':`, err.message);
              }
            }
            // Only mark as published if config.keywords is not set (i.e., not pre-assigned)
            if (!config.keywords || config.keywords.length === 0) {
              const uniqueKeywords = [...new Set([...keywordsToPublish, ...inArticleKeywords])];
              await prisma.keyword.updateMany({
                where: { keyword: { in: uniqueKeywords } },
                data: { published: true, publishedAt: new Date() }
              });
            }
            // await prisma.blogConfig.update({ where: { id: config.id }, data: { lastPublishedAt: now } });
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
      log('Scheduler scan finished');
    } catch (err) {
      log('❌ Scheduler error:', err.message);
    }
  });
  log('🕒 Blog scheduler running every minute...');
}
