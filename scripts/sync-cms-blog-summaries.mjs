import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import admin from 'firebase-admin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const serviceAccountPath = path.resolve(rootDir, 'secrets', 'firebase-admin-sdk.json');

if (!admin.apps.length) {
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else {
    admin.initializeApp();
  }
}

const db = admin.firestore();
const SOURCE_COLLECTION = 'cmsBlogPosts';
const TARGET_COLLECTION = 'cmsBlogPostSummaries';

const pickSummary = (docId, data) => ({
  slug: typeof data.slug === 'string' ? data.slug : '',
  title: typeof data.title === 'string' ? data.title : '',
  excerpt: typeof data.excerpt === 'string' ? data.excerpt : null,
  categorySlug: typeof data.categorySlug === 'string' ? data.categorySlug : null,
  tags: Array.isArray(data.tags) ? data.tags.filter((entry) => typeof entry === 'string') : [],
  coverImageUrl: typeof data.coverImageUrl === 'string' ? data.coverImageUrl : null,
  slugAliases: Array.isArray(data.slugAliases) ? data.slugAliases.filter((entry) => typeof entry === 'string') : [],
  seriesSlug: typeof data.seriesSlug === 'string' ? data.seriesSlug : null,
  relatedPostSlugs: Array.isArray(data.relatedPostSlugs) ? data.relatedPostSlugs.filter((entry) => typeof entry === 'string') : [],
  featuredUntil: data.featuredUntil || null,
  status: typeof data.status === 'string' ? data.status : 'draft',
  featured: data.featured === true,
  seoTitle: typeof data.seoTitle === 'string' ? data.seoTitle : null,
  seoDescription: typeof data.seoDescription === 'string' ? data.seoDescription : null,
  seoCanonicalUrl: typeof data.seoCanonicalUrl === 'string' ? data.seoCanonicalUrl : null,
  seoNoIndex: data.seoNoIndex === true,
  seoNoFollow: data.seoNoFollow === true,
  ogTitle: typeof data.ogTitle === 'string' ? data.ogTitle : null,
  ogDescription: typeof data.ogDescription === 'string' ? data.ogDescription : null,
  ogImageUrl: typeof data.ogImageUrl === 'string' ? data.ogImageUrl : null,
  twitterImageUrl: typeof data.twitterImageUrl === 'string' ? data.twitterImageUrl : null,
  authorName: typeof data.authorName === 'string' ? data.authorName : null,
  workflowAssignee: typeof data.workflowAssignee === 'string' ? data.workflowAssignee : null,
  reviewStatus: typeof data.reviewStatus === 'string' ? data.reviewStatus : 'not_requested',
  reviewNotes: typeof data.reviewNotes === 'string' ? data.reviewNotes : null,
  scheduledPublishAt: data.scheduledPublishAt || null,
  scheduledUnpublishAt: data.scheduledUnpublishAt || null,
  version: Number.isFinite(data.version) ? Number(data.version) : 1,
  publishedAt: data.publishedAt || null,
  createdBy: typeof data.createdBy === 'string' ? data.createdBy : 'sync-script',
  updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : 'sync-script',
  createdAt: data.createdAt || admin.firestore.FieldValue.serverTimestamp(),
  updatedAt: data.updatedAt || admin.firestore.FieldValue.serverTimestamp(),
  sourcePostId: docId,
});

const run = async () => {
  const sourceSnap = await db.collection(SOURCE_COLLECTION).get();
  if (sourceSnap.empty) {
    console.log('No blog posts found. Nothing to sync.');
    return;
  }

  let processed = 0;
  let batch = db.batch();
  let ops = 0;
  const BATCH_LIMIT = 400;

  for (const postDoc of sourceSnap.docs) {
    const payload = pickSummary(postDoc.id, postDoc.data());
    batch.set(db.collection(TARGET_COLLECTION).doc(postDoc.id), payload, { merge: true });
    processed += 1;
    ops += 1;
    if (ops >= BATCH_LIMIT) {
      await batch.commit();
      batch = db.batch();
      ops = 0;
    }
  }

  if (ops > 0) {
    await batch.commit();
  }

  console.log(`Synced ${processed} blog summary document(s) to ${TARGET_COLLECTION}.`);
};

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed to sync cms blog summaries:', error);
    process.exit(1);
  });

