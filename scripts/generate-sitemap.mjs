/**
 * @file scripts/generate-sitemap.mjs
 * @description Generates public/sitemap.xml (and keeps it current). Runs
 * automatically before every `npm run build` via the `prebuild` script, so the
 * sitemap's <lastmod> and URL set stay in sync without manual edits.
 *
 * Only PUBLIC, indexable pages belong here. The authenticated app routes
 * (/home, /study, /dashboard, /mock-study, /exam, /payment/*) sit behind login
 * and must NOT be crawled, and the /login, /register, /verify paths are
 * redirect aliases / one-off flow pages — all excluded on purpose.
 *
 * Source of truth for paths: routes.ts (PUBLIC_PATHS). Keep this list aligned
 * with it whenever a new public, indexable page is added.
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const SITE_URL = 'https://notce.ngnsimulation.com';

/** Public, crawlable pages. { path, priority, changefreq }. */
const PAGES = [
  { path: '/', priority: '1.0', changefreq: 'weekly' },
  { path: '/signup', priority: '0.8', changefreq: 'monthly' },
  { path: '/signin', priority: '0.5', changefreq: 'monthly' },
];

const lastmod = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

const urls = PAGES.map(({ path, priority, changefreq }) => {
  const loc = `${SITE_URL}${path === '/' ? '/' : path}`;
  return [
    '  <url>',
    `    <loc>${loc}</loc>`,
    `    <lastmod>${lastmod}</lastmod>`,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    '  </url>',
  ].join('\n');
}).join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

const outPath = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'sitemap.xml');
writeFileSync(outPath, xml, 'utf8');
console.log(`sitemap.xml written: ${PAGES.length} urls, lastmod ${lastmod} -> ${outPath}`);
