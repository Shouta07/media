// Deterministic HTML assembly for Field Notes articles.
// The model produces STRUCTURED CONTENT (see schema in generate-article.mjs);
// this module renders it into the exact same markup as the existing 12 posts,
// so SEO/GEO structure (JSON-LD @graph, meta, TL;DR/TOC/FAQ) is always correct.

const SITE = 'https://www.vitality-design.jp';
const GTAG = 'G-DWTE9DWQ0S';

// ---- helpers ----------------------------------------------------------------
const stripTags = (s = '') => String(s).replace(/<[^>]*>/g, '').trim();
const attr = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Allowlist of inline/block tags permitted inside model-authored bodyHtml.
const ALLOWED = new Set(['p', 'ul', 'ol', 'li', 'h3', 'strong', 'em', 'a', 'br', 'blockquote']);
function sanitizeHtml(html = '') {
  // Drop any tag not in the allowlist (keeps its text). Strip on* handlers and
  // disallowed href schemes on <a>.
  return String(html)
    .replace(/<\/?([a-zA-Z0-9]+)([^>]*)>/g, (m, tag, rest) => {
      const t = tag.toLowerCase();
      if (!ALLOWED.has(t)) return '';
      if (t === 'a') {
        const href = (rest.match(/href\s*=\s*"([^"]*)"/i) || [])[1] || '';
        const safe = /^(\/|https?:\/\/|#|mailto:)/i.test(href) ? href : '#';
        const ext = /^https?:\/\//i.test(safe) && !safe.startsWith(SITE);
        return m.startsWith('</')
          ? '</a>'
          : `<a href="${attr(safe)}"${ext ? ' target="_blank" rel="noopener"' : ''}>`;
      }
      return m.replace(/\son\w+\s*=\s*"[^"]*"/gi, '');
    })
    .replace(/<script[\s\S]*?<\/script>/gi, '');
}

// ---- head / JSON-LD ---------------------------------------------------------
function jsonLd(a, url, iso) {
  const graph = [
    {
      '@type': 'BlogPosting',
      '@id': `${url}#article`,
      headline: a.title,
      description: stripTags(a.metaDescription),
      image: { '@type': 'ImageObject', url: `${SITE}/og.png`, width: 1200, height: 630 },
      datePublished: iso,
      dateModified: iso,
      inLanguage: 'ja',
      articleSection: a.category,
      keywords: a.keywords.join(', '),
      wordCount: a.wordCount || 1600,
      author: {
        '@type': 'Organization',
        name: 'Vitality Design LLC',
        url: `${SITE}/`,
        description:
          '自由診療・ウェルネス産業の事業成長パートナー。自らもサービスを運営する当事者として、現場の一次情報をもとに事業を設計する。',
        sameAs: ['https://www.hisrecoveries.com/'],
      },
      publisher: {
        '@type': 'Organization',
        name: 'Vitality Design LLC',
        logo: { '@type': 'ImageObject', url: `${SITE}/icon-512.png`, width: 512, height: 512 },
      },
      mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'ホーム', item: `${SITE}/` },
        { '@type': 'ListItem', position: 2, name: 'Field Notes', item: `${SITE}/blog/` },
        { '@type': 'ListItem', position: 3, name: stripTags(a.ogTitle || a.title), item: url },
      ],
    },
    {
      '@type': 'FAQPage',
      mainEntity: a.faq.map((f) => ({
        '@type': 'Question',
        name: stripTags(f.q),
        acceptedAnswer: { '@type': 'Answer', text: stripTags(f.a) },
      })),
    },
  ];
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, null, 2);
}

// ---- full page --------------------------------------------------------------
export function renderArticle(a, isoDate) {
  const url = `${SITE}/blog/${a.slug}.html`;
  const date = isoDate.slice(0, 10); // YYYY-MM-DD
  const dateDot = date.replace(/-/g, '.');
  const iso = isoDate;

  const sections = a.sections
    .map(
      (s) =>
        `    <h2 id="${attr(s.id)}"><span class="no">${attr(s.no)}</span>${attr(
          stripTags(s.heading)
        )}</h2>\n${sanitizeHtml(s.bodyHtml).trim()}\n`
    )
    .join('\n');

  const toc = a.sections
    .map((s) => `        <li><a href="#${attr(s.id)}">${attr(stripTags(s.heading))}</a></li>`)
    .join('\n');

  const tldr = a.tldr.map((t) => `        <li>${sanitizeHtml(t)}</li>`).join('\n');

  const faq = a.faq
    .map(
      (f) =>
        `      <details>\n        <summary>${attr(
          stripTags(f.q)
        )}</summary>\n        <div class="fa-body">${sanitizeHtml(f.a)}</div>\n      </details>`
    )
    .join('\n');

  const related = a.related
    .map(
      (r) =>
        `      <a class="rel-link" href="${attr(r.href)}">\n        <span>${attr(
          r.cat
        )}</span>\n        <h3>${attr(stripTags(r.title))}</h3>\n      </a>`
    )
    .join('\n');

  const tags = a.tags.map((t) => `<meta property="article:tag" content="${attr(t)}">`).join('\n');

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${GTAG}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '${GTAG}');
</script>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${attr(stripTags(a.title))}｜Vitality Design</title>
<meta name="description" content="${attr(stripTags(a.metaDescription))}">
<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">
<meta name="author" content="Vitality Design LLC">
<meta name="keywords" content="${attr(a.keywords.join(','))}">
<link rel="canonical" href="${url}">
<meta property="og:site_name" content="Vitality Design LLC">
<meta property="og:locale" content="ja_JP">
<meta property="og:title" content="${attr(stripTags(a.ogTitle || a.title))}">
<meta property="og:description" content="${attr(stripTags(a.ogDescription || a.metaDescription))}">
<meta property="og:type" content="article">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="article:published_time" content="${iso}">
<meta property="article:modified_time" content="${iso}">
<meta property="article:section" content="${attr(a.section || a.crumb)}">
${tags}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${attr(stripTags(a.ogTitle || a.title))}">
<meta name="twitter:description" content="${attr(stripTags(a.ogDescription || a.metaDescription))}">
<meta name="twitter:image" content="${SITE}/og.png">
<meta name="theme-color" content="#0B6E4F">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="icon" type="image/png" sizes="96x96" href="/favicon-96.png">
<link rel="icon" type="image/png" sizes="512x512" href="/icon-512.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,300;0,6..72,400;1,6..72,300&family=Noto+Sans+JP:wght@400;500;700;900&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/blog/article.css">
<script type="application/ld+json">
${jsonLd(a, url, iso)}
</script>
</head>
<body>

<nav class="nav">
  <a href="/" class="nav-brand" aria-label="Vitality Design LLC home">
    <span class="nav-mark">
      <svg viewBox="0 0 44 44" fill="none" aria-hidden="true">
        <circle cx="22" cy="22" r="17" stroke="#10130F" stroke-width="2"/>
        <path d="M12 25 Q18 9 22 22 Q26 35 39 5" stroke="url(#pg)" stroke-width="2.8" fill="none" stroke-linecap="round"/>
        <defs><linearGradient id="pg" x1="10" y1="30" x2="40" y2="6" gradientUnits="userSpaceOnUse"><stop stop-color="#0B6E4F"/><stop offset=".55" stop-color="#0FA890"/><stop offset="1" stop-color="#14B870"/></linearGradient></defs>
      </svg>
    </span>
    <span class="nav-name"><span class="n-en">Vitality Design</span><span class="n-jp">バイタリティデザイン合同会社</span></span>
  </a>
  <a href="/#contact" class="nav-cta">お問い合わせ</a>
</nav>

<header class="ahead">
  <div class="wrap">
    <nav class="crumb" aria-label="パンくず"><a href="/">ホーム</a> <span>/</span> <a href="/blog/">Field Notes</a> <span>/</span> ${attr(a.crumb)}</nav>
    <div class="ameta">
      <span class="cat">${attr(a.category)}</span>
      <time class="date" datetime="${date}">${dateDot}</time>
    </div>
    <h1>${sanitizeHtml(a.titleHtml || a.title)}</h1>
    <p class="lead">${sanitizeHtml(a.lead)}</p>
    <div class="readmeta">
      <span class="author">Vitality Design LLC</span>
      <span class="dot"></span><span>自由診療・ウェルネスの事業成長パートナー</span>
      <span class="dot"></span><span>読了 約${a.readMinutes || 5}分</span>
    </div>
  </div>
</header>

<article class="article">
  <div class="wrap">

    <div class="tldr">
      <div class="tl-h">この記事の要点</div>
      <ul>
${tldr}
      </ul>
    </div>

    <nav class="toc" aria-label="目次">
      <div class="toc-h">目次</div>
      <ol>
${toc}
        <li><a href="#summary">まとめ</a></li>
        <li><a href="#faq">よくある質問（FAQ）</a></li>
      </ol>
    </nav>

    ${sanitizeHtml(a.introHtml).trim()}

${sections}
    <h2 id="summary"><span class="no">—</span>${attr(stripTags(a.summaryHeading || 'まとめ'))}</h2>
    <div class="takeaway"><span class="lbl">結論</span>${attr(stripTags(a.takeaway))}</div>
    ${sanitizeHtml(a.summaryHtml).trim()}

    <section class="afaq" id="faq" aria-label="よくある質問">
      <span class="eyebrow">FAQ</span>
${faq}
    </section>

    <div class="cta-box">
      <div class="m" aria-hidden="true"></div>
      <h2>${attr(stripTags(a.ctaHeading || '現場の課題は、設計できます。'))}</h2>
      <p>発注を前提とした売り込みはしません。「まず何から手をつけるべきか」を一緒に整理するだけでも歓迎です。いただいた内容には、創業者本人が直接ご返信します。</p>
      <div class="acts">
        <a class="btn bright" href="/#contact"><span>無料で相談する</span><span>→</span></a>
        <a class="btn outline" href="/blog/">記事一覧へ</a>
      </div>
    </div>

    <div class="related">
      <span class="eyebrow">Related</span>
${related}
    </div>

  </div>
</article>

<footer>
  <div class="wrap">
    <span class="fb-en">Vitality Design LLC</span>
    <span class="fb-jp">バイタリティデザイン合同会社 ｜ 人の活力を、デザインする。</span>
    <div class="fb-links">
      <a href="/">Home</a>
      <a href="/blog/">Field Notes</a>
      <a href="/principles.html">Principles</a>
      <a href="/#contact">Contact</a>
    </div>
    <div class="fb-base">© 2026 Vitality Design LLC. All rights reserved.</div>
  </div>
</footer>

</body>
</html>
`;
}

// ---- site file updates ------------------------------------------------------
// Category → thumbnail gradient class. Keep in sync with blog/index.html CSS.
function thumbClass(cat = '') {
  if (/集患|コンプライアンス/.test(cat)) return 't1';
  if (/カウンセリング|成約/.test(cat)) return 't2';
  if (/リピート|LTV|CRM/.test(cat)) return 't3';
  if (/データ|AI/.test(cat)) return 't5';
  if (/経営|組織|ブランド|価格/.test(cat)) return 't6';
  return 't4';
}

export function blogCard(a, isoDate) {
  const date = isoDate.slice(0, 10);
  const dot = date.replace(/-/g, '.');
  const label = String(a.category).split(' / ')[0].trim();
  return `    <a class="post reveal" href="/blog/${attr(a.slug)}.html">
      <div class="thumb ${thumbClass(a.category)}"><span>${attr(label)}</span></div>
      <div class="fbody">
      <div class="post-meta">
        <span class="post-cat">${attr(a.category)}</span>
        <time class="post-date" datetime="${date}">${dot}</time>
        <span class="post-date">読了 約${a.readMinutes || 5}分</span>
      </div>
      <h2>${attr(stripTags(a.title))}</h2>
      <p>${attr(stripTags(a.cardDescription || a.metaDescription))}</p>
      <span class="more">続きを読む<span class="ar">→</span></span>
      </div>
    </a>\n\n`;
}

export function blogPostLd(a, isoDate) {
  return `        {"@type":"BlogPosting","headline":${JSON.stringify(
    stripTags(a.title)
  )},"url":"${SITE}/blog/${a.slug}.html","datePublished":"${isoDate}","author":{"@id":"${SITE}/#org"}},\n`;
}

export function sitemapEntry(a, isoDate) {
  const date = isoDate.slice(0, 10);
  return `  <url>
    <loc>${SITE}/blog/${a.slug}.html</loc>
    <lastmod>${date}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
`;
}

export function llmsEntry(a) {
  return `- [${stripTags(a.title)}](${SITE}/blog/${a.slug}.html): ${stripTags(
    a.llmsSummary || a.metaDescription
  )}\n`;
}

export { SITE, stripTags, sanitizeHtml };
