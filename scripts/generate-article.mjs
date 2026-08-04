// Generate one SEO/GEO-optimized Vitality Notes article with Claude, matching the
// existing 12 posts, then render + wire it into the blog index / sitemap /
// llms.txt. The model returns STRUCTURED CONTENT (schema below); HTML assembly
// is deterministic (lib/render.mjs), so structured data is always valid.
//
//   node scripts/generate-article.mjs "テーマ" [--keywords "a,b"] [--notes "…"]
//
// Reads ANTHROPIC_API_KEY from the environment. Writes files but does NOT commit
// — the GitHub Actions workflow opens a PR for human review.
import Anthropic from '@anthropic-ai/sdk';
import { renderArticle } from './lib/render.mjs';
import {
  existingArticles, slugExists, writeArticle,
  updateBlogIndex, updateSitemap, updateLlms,
} from './lib/site.mjs';
import { validateFile } from './lib/validate.mjs';
import fs from 'node:fs';

// ---- args -------------------------------------------------------------------
const argv = process.argv.slice(2);
function flag(name) {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
}
const topic = (argv[0] && !argv[0].startsWith('--') ? argv[0] : flag('topic')) || process.env.INPUT_TOPIC;
const keywordsHint = flag('keywords') || process.env.INPUT_KEYWORDS || '';
const notes = flag('notes') || process.env.INPUT_NOTES || '';
if (!topic) {
  console.error('Usage: node scripts/generate-article.mjs "記事テーマ" [--keywords a,b] [--notes …]');
  process.exit(2);
}

// ---- JST date ---------------------------------------------------------------
const jst = new Date(Date.now() + 9 * 3600 * 1000);
const iso = `${jst.toISOString().slice(0, 10)}T09:00:00+09:00`;

// ---- structured-output schema ----------------------------------------------
const str = { type: 'string' };
const obj = (props) => ({
  type: 'object',
  additionalProperties: false,
  required: Object.keys(props),
  properties: props,
});
const SCHEMA = obj({
  slug: str, // ascii kebab-case, e.g. "clinic-line-repeat"
  category: str, // e.g. "オペレーション / 業務効率化"
  crumb: str, // short breadcrumb label, e.g. "オペレーション"
  section: str, // og:article:section
  tags: { type: 'array', items: str }, // 2-3
  keywords: { type: 'array', items: str }, // 6-8
  title: str, // full title (may use ―)
  titleHtml: str, // title with a single <br> for the h1
  ogTitle: str, // short title, no <br>
  metaDescription: str, // 120-160 Japanese chars, no HTML
  ogDescription: str, // shorter, no HTML
  cardDescription: str, // one sentence for the blog index card, no HTML
  llmsSummary: str, // one-sentence factual summary for llms.txt, no HTML
  lead: str, // lead paragraph; may use <strong>
  readMinutes: { type: 'integer' },
  wordCount: { type: 'integer' },
  tldr: { type: 'array', items: str }, // 3-4 bullets; may use <strong>
  introHtml: str, // opening <p>…</p> before the first h2
  sections: {
    type: 'array',
    items: obj({
      id: str, // e.g. "sec-01"
      no: str, // "01".."NN"
      heading: str, // plain text
      bodyHtml: str, // <p>/<ul>/<h3>/<strong>/<a href="/blog/…"> only
    }),
  },
  summaryHeading: str,
  takeaway: str, // plain text (one paragraph)
  summaryHtml: str, // closing <p>…</p>
  ctaHeading: str,
  faq: { type: 'array', items: obj({ q: str, a: str }) }, // 4 items; a may use <strong>
  related: { type: 'array', items: obj({ href: str, cat: str, title: str }) }, // 2, from existing
});

// ---- prompt -----------------------------------------------------------------
const existing = existingArticles();
const catalog = existing
  .map((e) => `- slug=${e.slug} | ${e.category} | ${e.title}`)
  .join('\n');

const SYSTEM = `あなたは「Vitality Design（バイタリティデザイン合同会社）」のオウンドメディア「Vitality Notes」の編集者兼ライターです。
読者は自由診療・ウェルネス（美容クリニック、AGA、サロン、パーソナルジム等）の経営者・現場責任者。
会社は「提案ではなく実行」する当事者（自社サービス His Recoveries を運営）で、現場の一次情報に基づく実践知を届けます。

# 執筆方針
- 日本語。既存記事と同じトーン（誠実・具体的・現場目線・煽らない）。
- SEO/GEO最適化：検索意図に答え、AIに引用されやすい構造（要点→本文→FAQ）。
- 本文セクションは3〜4本。各セクションは <p> と、必要に応じ <ul><li> / <h3> / <strong> を使う。
- 内部リンクは既存記事の slug のみに貼る（存在しない slug は禁止）。関連記事 related は既存から2本選ぶ。
- TLDR は3〜4項目、FAQ は4問。meta description は120〜160字。

# 医療広告ガイドライン・景品表示法の厳守（最重要）
- 「効果を保証」「必ず治る」「確実に」「日本一」「No.1」「100%」等の断定・優良誤認表現は絶対に使わない。
- 数値の効果や事例を捏造しない。一般論・原則として書く。
- ビフォーアフター等に言及する場合も、限定解除要件（費用・リスク明示）に触れる程度に留める。

# 出力
- 指定された JSON スキーマに厳密に従う。HTMLは許可タグ（<p> <ul> <ol> <li> <h3> <strong> <em> <a> <br>）のみ。
- slug は英小文字・ハイフンの kebab-case（既存と重複しない）。`;

const USER = `# 新しい記事のテーマ
${topic}
${keywordsHint ? `\n# 狙いたいキーワード\n${keywordsHint}` : ''}
${notes ? `\n# 補足メモ\n${notes}` : ''}

# 既存記事（重複を避け、内部リンク・関連記事はここから選ぶ）
${catalog}

上記テーマで、既存記事と重複しない新規記事を1本、JSONスキーマに従って作成してください。`;

// ---- generate ---------------------------------------------------------------
const client = new Anthropic(); // reads ANTHROPIC_API_KEY
console.log(`Generating article for topic: ${topic}`);

const res = await client.messages.create({
  model: 'claude-opus-4-8',
  max_tokens: 16000,
  thinking: { type: 'adaptive' },
  output_config: { format: { type: 'json_schema', schema: SCHEMA } },
  system: SYSTEM,
  messages: [{ role: 'user', content: USER }],
});

if (res.stop_reason === 'refusal') {
  console.error('モデルがリクエストを拒否しました。', res.stop_details);
  process.exit(1);
}
const textBlock = res.content.find((b) => b.type === 'text');
if (!textBlock) {
  console.error('テキスト出力がありません。', res.stop_reason);
  process.exit(1);
}
const a = JSON.parse(textBlock.text);

// ---- normalize + guard ------------------------------------------------------
a.slug = String(a.slug).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
if (!a.slug) { console.error('slug が空です'); process.exit(1); }
if (slugExists(a.slug)) {
  console.error(`slug が既存記事と重複しています: ${a.slug}`);
  process.exit(1);
}
// Keep only related links that point to real existing articles.
const knownHrefs = new Set(existing.map((e) => e.href));
a.related = (a.related || []).filter((r) => knownHrefs.has(r.href)).slice(0, 2);
if (a.related.length < 2) {
  const extra = existing.filter((e) => !a.related.some((r) => r.href === e.href)).slice(0, 2 - a.related.length);
  a.related.push(...extra.map((e) => ({ href: e.href, cat: e.category, title: e.title })));
}

// ---- render + wire in -------------------------------------------------------
writeArticle(a.slug, renderArticle(a, iso));
updateBlogIndex(a, iso);
updateSitemap(a, iso);
updateLlms(a);
console.log(`Wrote blog/${a.slug}.html and updated index / sitemap / llms.txt`);

// ---- validate ---------------------------------------------------------------
const { errors, warnings } = validateFile(a.slug);
if (warnings.length) {
  console.log('\n⚠️  警告（人のレビューで確認）:');
  warnings.forEach((w) => console.log(`   - ${w}`));
}
if (errors.length) {
  console.error('\n❌ 検証エラー（PRを作成しません）:');
  errors.forEach((e) => console.error(`   - ${e}`));
  process.exit(1);
}
console.log('\n✅ 検証OK');

// ---- outputs for the workflow ----------------------------------------------
if (process.env.GITHUB_OUTPUT) {
  const out = [
    `slug=${a.slug}`,
    `title=${a.title.replace(/\n/g, ' ')}`,
    `warnings=${warnings.length}`,
  ].join('\n');
  fs.appendFileSync(process.env.GITHUB_OUTPUT, out + '\n');
  // Multi-line warning body for the PR.
  fs.appendFileSync(
    process.env.GITHUB_OUTPUT,
    `warnings_body<<EOF\n${warnings.map((w) => `- ${w}`).join('\n') || '(なし)'}\nEOF\n`
  );
}
