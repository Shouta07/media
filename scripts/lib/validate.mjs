// Automated checks that gate a generated article before it becomes a PR.
// Returns { errors:[], warnings:[] }. Hard errors block; warnings are surfaced
// in the PR body for the human reviewer.
import fs from 'node:fs';
import path from 'node:path';
import { BLOG_DIR } from './site.mjs';

// Hard blocks: guarantee/絶対 claims are unsafe under 医療広告ガイドライン / 景表法.
const HARD = [
  '効果を保証', '効果は保証', '成果を保証', '必ず治', '必ず改善', '確実に治',
  '確実に改善', '100%', '１００％', '日本一', '世界一', '最安値', 'No.1', 'ナンバーワン',
];
// Soft warnings:断定/誇張 that a human should double-check.
const SOFT = ['必ず', '確実に', '絶対に', '完全に', '誰でも', '例外なく', '最高の', '唯一の'];

export function validateArticleHtml(html, slug) {
  const errors = [];
  const warnings = [];

  // 1. JSON-LD blocks parse
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  if (blocks.length === 0) errors.push('JSON-LD ブロックが見つかりません');
  for (const [, body] of blocks) {
    try {
      JSON.parse(body);
    } catch (e) {
      errors.push(`JSON-LD が不正です: ${e.message}`);
    }
  }

  // 2. Required head elements
  const required = [
    [/<title>[^<]+<\/title>/, '<title>'],
    [/<meta name="description" content="[^"]{40,}"/, 'meta description (40字以上)'],
    [/<link rel="canonical"/, 'canonical'],
    [/<meta property="og:title"/, 'og:title'],
    [/<meta property="og:image"/, 'og:image'],
    [/<meta name="twitter:card"/, 'twitter:card'],
    [/googletagmanager\.com\/gtag\/js/, 'GA gtag'],
    [/<link rel="stylesheet" href="\/blog\/article\.css">/, 'article.css'],
    [/"@type":\s*"BlogPosting"/, 'BlogPosting schema'],
    [/"@type":\s*"FAQPage"/, 'FAQPage schema'],
    [/"@type":\s*"BreadcrumbList"/, 'BreadcrumbList schema'],
  ];
  for (const [re, name] of required) if (!re.test(html)) errors.push(`必須要素が欠落: ${name}`);

  // 3. meta description length (Google snippet safety)
  const desc = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '';
  if (desc.length > 160) warnings.push(`meta description が長い (${desc.length}字) — 120〜160字推奨`);

  // 4. Internal /blog/ links point to real files (existing or this slug)
  const known = new Set(
    fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith('.html')).map((f) => f.replace(/\.html$/, ''))
  );
  known.add(slug);
  for (const m of html.matchAll(/href="\/blog\/([a-z0-9-]+)\.html"/g)) {
    if (!known.has(m[1])) errors.push(`内部リンク切れ: /blog/${m[1]}.html`);
  }

  // 5. Advertising-law lint on visible text
  const text = html
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<[^>]+>/g, ' ');
  for (const kw of HARD) if (text.includes(kw)) errors.push(`禁止表現の可能性: 「${kw}」（医療広告/景表法）`);
  for (const kw of SOFT) if (text.includes(kw)) warnings.push(`要確認の断定表現: 「${kw}」`);

  return { errors, warnings };
}

export function validateFile(slug) {
  const html = fs.readFileSync(path.join(BLOG_DIR, `${slug}.html`), 'utf8');
  return validateArticleHtml(html, slug);
}
