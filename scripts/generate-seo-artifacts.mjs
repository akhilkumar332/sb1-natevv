import { writeFile } from 'fs/promises';
import path from 'path';

const BASE_URL = (process.env.VITE_PUBLIC_SITE_URL || 'https://bloodhubindia.com').replace(/\/+$/, '');

const STATIC_ROUTES = [
  '/',
  '/find-donors',
  '/request-blood',
  '/about',
  '/contact',
  '/blog',
];

const nowIso = new Date().toISOString();

const robotsTxt = `User-agent: *
Allow: /

Sitemap: ${BASE_URL}/sitemap-static.xml
`;

const xmlEscape = (value) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${STATIC_ROUTES.map((route) => `  <url>
    <loc>${xmlEscape(`${BASE_URL}${route}`)}</loc>
    <lastmod>${nowIso}</lastmod>
    <changefreq>${route === '/blog' ? 'daily' : 'weekly'}</changefreq>
    <priority>${route === '/' ? '1.0' : '0.8'}</priority>
  </url>`).join('\n')}
</urlset>
`;

const run = async () => {
  const publicDir = path.resolve('public');
  await writeFile(path.join(publicDir, 'robots.txt'), robotsTxt, 'utf8');
  await writeFile(path.join(publicDir, 'sitemap-static.xml'), sitemap, 'utf8');
  console.log('Generated SEO artifacts: public/robots.txt, public/sitemap-static.xml');
};

run().catch((error) => {
  console.error('Failed to generate SEO artifacts:', error);
  process.exit(1);
});
