import express from 'express';
import prisma from '../database.js';

const router = express.Router();

// Middleware to require authentication and set req.user.userId
router.use((req, res, next) => {
  // Example: req.user should be set by authentication middleware (e.g., JWT)
  // If not present, reject the request
  if (!req.user || !req.user.userId) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
  next();
});

// POST /api/save-config (create new blog config)
router.post('/save-config', async (req, res) => {
  try {
    const config = req.body;
    const userId = req.user.userId;
    // Save config to BlogConfig table
    let publishIntervalMinutes = null;
    let scheduleTime = null;
    if (config.exhaustAllKeywords) {
      publishIntervalMinutes = config.publishIntervalMinutes || config.publishInterval || null;
    } else {
      scheduleTime = config.scheduleTime || null;
    }
    // Normalize category: accept 'category' (string) or 'categories' (array, string, or JSON string)
    let category = '';
    if (typeof config.category === 'string' && config.category.trim()) {
      category = config.category.trim();
    } else if (Array.isArray(config.categories) && config.categories.length > 0) {
      category = config.categories[0];
    } else if (typeof config.categories === 'string' && config.categories.trim()) {
      // Try to parse as JSON array
      let catStr = config.categories.trim();
      try {
        const parsed = JSON.parse(catStr);
        if (Array.isArray(parsed) && parsed.length > 0) {
          category = parsed[0];
        } else if (typeof parsed === 'string') {
          category = parsed;
        } else {
          // Fallback: treat as comma-separated string
          category = catStr.split(',').map(c => c.trim()).filter(Boolean)[0] || '';
        }
      } catch {
        // Not JSON, treat as comma-separated string
        category = catStr.split(',').map(c => c.trim()).filter(Boolean)[0] || '';
      }
    }
    let exhaustAllKeywords = config.exhaustAllKeywords;
    if (config.contentSource === 'openai') {
      exhaustAllKeywords = config.exhaustAllKeywords === true;
    } else if (exhaustAllKeywords === undefined) {
      exhaustAllKeywords = true;
    }
    let inArticleKeywords = [];
    if (typeof config.inArticleKeywords === 'string') {
      inArticleKeywords = config.inArticleKeywords.split(',').map(k => k.trim()).filter(Boolean).slice(0, 3);
    } else if (Array.isArray(config.inArticleKeywords)) {
      inArticleKeywords = config.inArticleKeywords.slice(0, 3);
    }
    const newConfig = await prisma.blogConfig.create({
      data: {
        userId,
        sites: JSON.stringify(config.sites || []),
        links: JSON.stringify(config.links || []),
        tags: JSON.stringify(config.tags || []),
        topics: JSON.stringify(config.topics || []),
        categories: category, // Always store as a string
        autoTitle: config.autoTitle ?? true,
        articleCount: config.articleCount || 1,
        keywordsPerArticle: config.keywordsPerArticle || 1,
        publishIntervalMinutes,
        scheduleTime,
        hasRun: false, // Ensure hasRun is false on create
        contentSource: config.contentSource || 'openai',
        engine: config.engine || null,
        inArticleKeywords: JSON.stringify(inArticleKeywords),
        exhaustAllKeywords,
      },
    });
    res.status(200).json({ success: true, message: 'Blog config saved.', config: newConfig });
  } catch (err) {
    console.error('❌ Error saving blog config:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/configs (get all blog configs for user)
router.get('/configs', async (req, res) => {
  try {
    const userId = req.user.userId;
    const configs = await prisma.blogConfig.findMany({ where: { userId } });
    res.status(200).json({ success: true, configs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/config/:id (get a single config for user)
router.get('/config/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const config = await prisma.blogConfig.findFirst({ where: { id: Number(id), userId } });
    if (!config) {
      return res.status(404).json({ success: false, error: 'Config not found' });
    }
    res.status(200).json({ success: true, config });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/delete-published/:id (delete a published blog config by id for user)
router.delete('/delete-published/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    await prisma.blogConfig.deleteMany({ where: { id: Number(id), userId } });
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/delete-all-published (delete all published blog configs for user)
router.delete('/delete-all-published', async (req, res) => {
  try {
    const userId = req.user.userId;
    await prisma.blogConfig.deleteMany({ where: { userId } });
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// SiteConfig CRUD (user-based)
// POST /api/save-site (add a new site config to DB for user)
router.post('/save-site', async (req, res) => {
  try {
    const { name, url, username, password } = req.body;
    const userId = req.user.userId;
    const site = await prisma.siteConfig.create({
      data: { name, url, username, password, userId },
    });
    res.status(200).json({ success: true, site });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/sites (get all site configs for user)
router.get('/sites', async (req, res) => {
  try {
    const userId = req.user.userId;
    const sites = await prisma.siteConfig.findMany({ where: { userId } });
    res.status(200).json({ success: true, sites });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/site-configs (fetch all site configs for user)
router.get('/site-configs', async (req, res) => {
  try {
    const userId = req.user.userId;
    const configs = await prisma.siteConfig.findMany({ where: { userId } });
    res.status(200).json({ success: true, configs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/save-site-configs (save or update multiple site configs for user)
router.post('/save-site-configs', async (req, res) => {
  try {
    const { sites } = req.body;
    const userId = req.user.userId;
    if (!Array.isArray(sites)) {
      return res.status(400).json({ success: false, error: 'Sites must be an array' });
    }
    // Upsert each site config (by url+username+userId)
    const results = [];
    for (const site of sites) {
      if (!site.url || !site.username) continue;
      const upserted = await prisma.siteConfig.upsert({
        where: {
          url_username: {
            url: site.url,
            username: site.username
          }
        },
        update: {
          password: site.password,
          name: site.name || site.url
        },
        create: {
          url: site.url,
          username: site.username,
          password: site.password,
          name: site.name || site.url,
          userId
        }
      });
      results.push(upserted);
    }
    res.status(200).json({ success: true, siteConfigs: results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
