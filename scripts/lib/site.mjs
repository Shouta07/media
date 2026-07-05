// Read existing article metadata and apply site-file updates (blog index,
// sitemap, llms.txt) after a new article is rendered.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { blogCard, blogPostLd, sitemapEntry, llmsEntry } from './render.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const BLOG_DIR = path.join(ROOT, 'blog');

// Pull title + meta description from each existing blog/*.html so the model can
// avoid duplicating topics and pick real internal links / related posts.
export function existingArticles() {
  const files = fs
    .readdirSync(BLOG_DIR)
    .filter((f) => f.endsWith('.html') && f !== 'index.html');
  return files.map((f) => {
    const html = fs.readFileSync(path.join(BLOG_DIR, f), 'utf8');
    const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
    const desc = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '';
    const cat = (html.match(/<span class="cat">([^<]*)<\/span>/) || [])[1] || '';
    return {
      slug: f.replace(/\.html$/, ''),
      href: `/blog/${f}`,
      title: title.replace(/｜Vitality Design$/, ''),
      category: cat,
      description: desc,
    };
  });
}

export function slugExists(slug) {
  return fs.existsSync(path.join(BLOG_DIR, `${slug}.html`));
}

export function writeArticle(slug, html) {
  fs.writeFileSync(path.join(BLOG_DIR, `${slug}.html`), html);
}

// Insert card at the TOP of the post list (newest first) and add a blogPost
// entry to the Blog JSON-LD @graph.
export function updateBlogIndex(a, iso) {
  const p = path.join(BLOG_DIR, 'index.html');
  let html = fs.readFileSync(p, 'utf8');

  const cardAnchor = '  <div class="wrap">\n\n    <a class="post reveal"';
  if (!html.includes(cardAnchor)) throw new Error('blog/index.html: card anchor not found');
  html = html.replace(
    cardAnchor,
    `  <div class="wrap">\n\n${blogCard(a, iso)}    <a class="post reveal"`
  );

  const ldAnchor = '      "blogPost":[\n';
  if (!html.includes(ldAnchor)) throw new Error('blog/index.html: blogPost anchor not found');
  html = html.replace(ldAnchor, ldAnchor + blogPostLd(a, iso));

  fs.writeFileSync(p, html);
}

export function updateSitemap(a, iso) {
  const p = path.join(ROOT, 'sitemap.xml');
  let xml = fs.readFileSync(p, 'utf8');
  if (!xml.includes('</urlset>')) throw new Error('sitemap.xml: </urlset> not found');
  xml = xml.replace('</urlset>', sitemapEntry(a, iso) + '</urlset>');
  fs.writeFileSync(p, xml);
}

export function updateLlms(a) {
  const p = path.join(ROOT, 'llms.txt');
  let txt = fs.readFileSync(p, 'utf8');
  // Append after the last blog entry line in the ブログ section.
  const marker = '\n## よくある質問';
  if (txt.includes(marker)) {
    txt = txt.replace(marker, llmsEntry(a) + marker);
  } else {
    txt += '\n' + llmsEntry(a);
  }
  fs.writeFileSync(p, txt);
}

export { ROOT };
