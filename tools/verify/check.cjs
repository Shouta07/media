#!/usr/bin/env node
/**
 * コーポレートサイトの自動チェック。
 *
 *   npx playwright install chromium   # 初回のみ
 *   node tools/verify/check.cjs       # 既定で http://localhost:8237 を見る
 *   BASE=https://example.vercel.app node tools/verify/check.cjs
 *
 * 見ているもの:
 *   - 横スクロールの発生（320〜1920px）
 *   - 文字の切れ
 *   - 本文テキストのコントラスト比（WCAG AA 4.5:1、祖先を遡って実効背景を合成して判定）
 *   - リンク切れ（ページ内アンカー）
 *   - id の重複
 *   - JS エラー
 *   - JSON-LD が JSON として妥当か
 *   - 問い合わせフォームの入力検証
 *
 * 1件でも落ちたら exit 1。CI に載せる場合はこれをそのまま使う。
 */
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://localhost:8237';
const PAGES = ['/', '/en/', '/zh/'];
const WIDTHS = [320, 375, 390, 430, 768, 1024, 1280, 1440, 1920];

let failed = 0;
const bad = (msg) => { failed++; console.log('  NG  ' + msg); };
const ok = (msg) => console.log('  ok  ' + msg);

/** rgba を順に重ねて実効色を出す（半透明の背景を正しく評価するため） */
function flatten(layers) {
  let [r, g, b] = [255, 255, 255];
  // layers は「下から上」の順。白地から順に重ねていく。
  for (let i = 0; i < layers.length; i++) {
    const [lr, lg, lb, la] = layers[i];
    r = lr * la + r * (1 - la);
    g = lg * la + g * (1 - la);
    b = lb * la + b * (1 - la);
  }
  return [r, g, b];
}
function luminance([r, g, b]) {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function ratio(fg, bg) {
  const a = luminance(fg), b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

(async () => {
  const browser = await chromium.launch();

  for (const path of PAGES) {
    const url = BASE.replace(/\/$/, '') + path;
    console.log('\n=== ' + url + ' ===');
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const jsErrors = [];
    page.on('pageerror', (e) => jsErrors.push(e.message));

    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    } catch (e) {
      bad('ページを開けません: ' + e.message);
      await page.close();
      continue;
    }

    // ---- 構造 ----
    const struct = await page.evaluate(() => {
      const ids = [...document.querySelectorAll('[id]')].map((n) => n.id);
      const dup = ids.filter((v, i) => ids.indexOf(v) !== i);
      const anchors = [...document.querySelectorAll('a[href^="#"]')]
        .map((a) => a.getAttribute('href').slice(1))
        .filter((id) => id && !document.getElementById(id));
      const ld = [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => s.textContent);
      const h1 = document.querySelectorAll('h1').length;
      const imgsNoAlt = [...document.querySelectorAll('img')].filter((i) => !i.hasAttribute('alt')).length;
      return { dup: [...new Set(dup)], anchors: [...new Set(anchors)], ld, h1, imgsNoAlt, lang: document.documentElement.lang };
    });
    struct.dup.length ? bad('id の重複: ' + struct.dup.join(', ')) : ok('id 重複なし');
    struct.anchors.length ? bad('リンク切れ: #' + struct.anchors.join(', #')) : ok('ページ内リンク切れなし');
    struct.h1 === 1 ? ok('h1 は1つ') : bad('h1 が ' + struct.h1 + ' 個');
    struct.imgsNoAlt ? bad('alt のない img が ' + struct.imgsNoAlt + ' 枚') : ok('img の alt 欠落なし');
    for (const raw of struct.ld) {
      try { JSON.parse(raw); ok('JSON-LD は妥当'); }
      catch (e) { bad('JSON-LD が壊れています: ' + e.message); }
    }
    if (!struct.lang) bad('<html lang> が空');

    // ---- コントラスト ----
    const samples = await page.evaluate(() => {
      const out = [];
      const parse = (c) => {
        const m = c.match(/rgba?\(([^)]+)\)/);
        if (!m) return null;
        const p = m[1].split(',').map((x) => parseFloat(x));
        return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
      };
      document.querySelectorAll('p,span,a,li,h1,h2,h3,h4,b,strong,em,label,button,td,th,i,u').forEach((el) => {
        if (el.children.length) return;
        const text = (el.textContent || '').trim();
        if (!text) return;
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) return;
        const st = getComputedStyle(el);
        if (st.visibility === 'hidden' || st.display === 'none' || parseFloat(st.opacity) < 0.1) return;
        const fg = parse(st.color);
        if (!fg) return;
        const layers = [];
        for (let n = el; n; n = n.parentElement) {
          const bgc = parse(getComputedStyle(n).backgroundColor);
          if (bgc && bgc[3] > 0) layers.unshift(bgc);
        }
        out.push({ text: text.slice(0, 30), fg, layers, size: parseFloat(st.fontSize), weight: st.fontWeight });
      });
      return out;
    });
    let contrastNG = 0;
    for (const s of samples) {
      const bgFlat = flatten(s.layers.length ? s.layers : [[255, 255, 255, 1]]);
      const fgFlat = flatten([...s.layers, [s.fg[0], s.fg[1], s.fg[2], s.fg[3]]]);
      const rr = ratio(fgFlat, bgFlat);
      const large = s.size >= 24 || (s.size >= 18.66 && parseInt(s.weight, 10) >= 700);
      const need = large ? 3 : 4.5;
      if (rr < need) {
        contrastNG++;
        if (contrastNG <= 5) bad(`コントラスト ${rr.toFixed(2)} (必要 ${need}) : "${s.text}"`);
      }
    }
    contrastNG ? bad('コントラスト違反 合計 ' + contrastNG + '件') : ok('コントラスト違反なし（' + samples.length + '要素を判定）');

    // ---- フォーム ----
    if (await page.$('#vdForm')) {
      await page.click('.fbtn');
      const e1 = (await page.$eval('#fstat', (n) => n.textContent)).trim();
      await page.fill('#f-company', 'X');
      await page.fill('#f-name', 'Y');
      await page.fill('#f-email', 'not-an-email');
      await page.click('.fbtn');
      const e2 = (await page.$eval('#fstat', (n) => n.textContent)).trim();
      e1 ? ok('未入力を検知: ' + e1.slice(0, 40)) : bad('未入力でもエラーが出ない');
      e2 && e2 !== e1 ? ok('不正なメールを検知: ' + e2.slice(0, 40)) : bad('不正なメールを検知できない');
    }

    // ---- 各幅 ----
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: 900 });
      await page.waitForTimeout(140);
      const r = await page.evaluate(() => {
        const d = document.documentElement;
        const hs = d.scrollWidth - d.clientWidth;
        let clipped = 0;
        document.querySelectorAll('h1,h2,h3,p,span,b,a,li,label,button').forEach((e) => {
          if (!e.children.length && e.scrollWidth > e.clientWidth + 2) clipped++;
        });
        const nav = getComputedStyle(document.querySelector('.nav-links')).display !== 'none';
        const burger = getComputedStyle(document.getElementById('burger')).display !== 'none';
        return { hs, clipped, reachable: nav || burger };
      });
      const issues = [];
      if (r.hs > 0) issues.push('横スクロール ' + r.hs + 'px');
      if (r.clipped > 0) issues.push('文字切れ ' + r.clipped + '件');
      if (!r.reachable) issues.push('ナビに到達できない');
      issues.length ? bad(w + 'px: ' + issues.join(' / ')) : ok(w + 'px');
    }

    jsErrors.length ? bad('JS エラー: ' + jsErrors.join(' | ')) : ok('JS エラーなし');
    await page.close();
  }

  await browser.close();
  console.log('\n' + (failed ? `NG ${failed}件` : 'すべて通過'));
  process.exit(failed ? 1 : 0);
})();
