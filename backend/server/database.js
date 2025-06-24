import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// --- KEYWORD FUNCTIONS ---
// Example: Fetch all keywords for a user
export async function getAllKeywords(userId) {
  return prisma.keyword.findMany({ where: { userId } });
}

// Example: Save a new keyword for a user
export async function saveKeyword(data) {
  if (!data.userId) throw new Error('userId is required');
  return prisma.keyword.create({ data });
}

// Example: Mark keyword as published (user-scoped)
export async function markKeywordPublished(id, userId) {
  return prisma.keyword.update({ where: { id, userId }, data: { published: true } });
}

// Get unpublished keywords with optional filters (user-scoped)
export async function getUnpublishedKeywords({ userId, siteUrl, configId, limit = 5 } = {}) {
  const where = { published: false, userId };
  if (siteUrl) where.site = siteUrl;
  if (configId) where.configId = configId;
  return prisma.keyword.findMany({ where, take: limit });
}

// Mark keyword as published by keyword and site (user-scoped)
export async function markKeywordPublishedByKeywordAndSite(keyword, siteUrl, userId) {
  return prisma.keyword.updateMany({
    where: { keyword, site: siteUrl, userId },
    data: { published: true, publishedOn: { push: new Date() }, updatedAt: new Date() }
  });
}

// --- PUBLICATION FUNCTIONS ---
// Create a publication
export async function createPublication(data) {
  if (!data.userId) throw new Error('userId is required');
  return prisma.publication.create({ data });
}

// Get all publications for a user
export async function getUserPublications(userId) {
  return prisma.publication.findMany({ where: { userId } });
}

// Get a publication by id and user
export async function getPublicationById(id, userId) {
  return prisma.publication.findUnique({ where: { id, userId } });
}

// Update a publication (user-scoped)
export async function updatePublication(id, userId, data) {
  return prisma.publication.update({ where: { id, userId }, data });
}

// Delete a publication (user-scoped)
export async function deletePublication(id, userId) {
  return prisma.publication.delete({ where: { id, userId } });
}

// --- BLOG CONFIG FUNCTIONS ---
export async function getUserBlogConfigs(userId) {
  return prisma.blogConfig.findMany({ where: { userId } });
}
export async function getBlogConfigById(id, userId) {
  return prisma.blogConfig.findUnique({ where: { id, userId } });
}
export async function updateBlogConfig(id, userId, data) {
  return prisma.blogConfig.update({ where: { id, userId }, data });
}
export async function deleteBlogConfig(id, userId) {
  return prisma.blogConfig.delete({ where: { id, userId } });
}

// --- SITE CONFIG FUNCTIONS ---
export async function getUserSiteConfigs(userId) {
  return prisma.siteConfig.findMany({ where: { userId } });
}
export async function getSiteConfigById(id, userId) {
  return prisma.siteConfig.findUnique({ where: { id, userId } });
}
export async function updateSiteConfig(id, userId, data) {
  return prisma.siteConfig.update({ where: { id, userId }, data });
}
export async function deleteSiteConfig(id, userId) {
  return prisma.siteConfig.delete({ where: { id, userId } });
}

// --- ARTICLE FUNCTIONS ---
export async function getUserArticles(userId) {
  return prisma.article.findMany({ where: { userId } });
}
export async function getArticleById(id, userId) {
  return prisma.article.findUnique({ where: { id, userId } });
}
export async function updateArticle(id, userId, data) {
  return prisma.article.update({ where: { id, userId }, data });
}
export async function deleteArticle(id, userId) {
  return prisma.article.delete({ where: { id, userId } });
}

export default prisma;
