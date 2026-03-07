import { writeFile } from 'fs/promises';
import path from 'path';

const BASE_URL = (process.env.VITE_PUBLIC_SITE_URL || 'https://bloodhubindia.com').replace(/\/+$/, '');

const CORE_ROUTES = [
  { path: '/', changefreq: 'daily', priority: '1.0' },
  { path: '/about', changefreq: 'monthly', priority: '0.7' },
  { path: '/contact', changefreq: 'monthly', priority: '0.7' },
];

const PAGE_ROUTES = [
  { path: '/find-donors', changefreq: 'weekly', priority: '0.8' },
  { path: '/request-blood', changefreq: 'weekly', priority: '0.8' },
];

const BLOG_ROUTES = [
  { path: '/blog', changefreq: 'daily', priority: '0.8' },
];

const nowIso = new Date().toISOString();

const robotsTxt = `User-agent: *
Allow: /

Sitemap: ${BASE_URL}/sitemap.xml
`;

const xmlEscape = (value) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

const toUrlSet = (routes) => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes.map((route) => `  <url>
    <loc>${xmlEscape(`${BASE_URL}${route.path}`)}</loc>
    <lastmod>${nowIso}</lastmod>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
  </url>`).join('\n')}
</urlset>
`;

const sitemapIndex = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${xmlEscape(`${BASE_URL}/sitemap-static.xml`)}</loc>
    <lastmod>${nowIso}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${xmlEscape(`${BASE_URL}/sitemap-pages.xml`)}</loc>
    <lastmod>${nowIso}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${xmlEscape(`${BASE_URL}/sitemap-blog.xml`)}</loc>
    <lastmod>${nowIso}</lastmod>
  </sitemap>
</sitemapindex>
`;

const run = async () => {
  const publicDir = path.resolve('public');
  const staticSitemap = toUrlSet(CORE_ROUTES);
  const pagesSitemap = toUrlSet(PAGE_ROUTES);
  const blogSitemap = toUrlSet(BLOG_ROUTES);
  await writeFile(path.join(publicDir, 'robots.txt'), robotsTxt, 'utf8');
  await writeFile(path.join(publicDir, 'sitemap.xml'), sitemapIndex, 'utf8');
  await writeFile(path.join(publicDir, 'sitemap-static.xml'), staticSitemap, 'utf8');
  await writeFile(path.join(publicDir, 'sitemap-pages.xml'), pagesSitemap, 'utf8');
  await writeFile(path.join(publicDir, 'sitemap-blog.xml'), blogSitemap, 'utf8');
  console.log('Generated SEO artifacts: public/robots.txt, public/sitemap.xml, public/sitemap-static.xml, public/sitemap-pages.xml, public/sitemap-blog.xml');
};

run().catch((error) => {
  console.error('Failed to generate SEO artifacts:', error);
  process.exit(1);
});
