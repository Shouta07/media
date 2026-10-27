# vitality-design.jp

バイタリティデザイン合同会社（Vitality Design LLC）のコーポレートサイト。

ビルド工程のない静的サイト。HTML / CSS / バニラ JS のみで、フレームワークもバンドラも使っていない。
Vercel が静的ホスティングしている。

---

## 1. すぐ動かす

```bash
git clone <repo> && cd media
git checkout claude/b2b-homepage-design-cl39bk   # ← 最新はこのブランチ。下の「ブランチ」を必ず読むこと
python3 -m http.server 8237
open http://localhost:8237/
```

これだけ。依存のインストールもビルドも不要。

---

## 2. ブランチ（重要）

**このリポジトリには `main` がない。** ブランチが8本あり、どれが本番かは Git からは判断できない。

| ブランチ | 中身 |
| --- | --- |
| `claude/b2b-homepage-design-cl39bk` | **現行のコーポレートサイト。作業はここ** |
| `claude/create-borders-landing-708EY` | 旧 `/service`（2026-09） |
| `claude/blog-seo-geo-structure-mnl6rf` ほか5本 | 過去の作業ブランチ |

本番 URL がどれを配信しているかは **Vercel → Settings → Git → Production Branch** を見るしかない。

**最初にやること**

1. Vercel の Production Branch を確認する
2. `claude/b2b-homepage-design-cl39bk` でなければ、プレビュー URL で内容を確認してから切り替える
3. 落ち着いたら `main` を作って整理する（ブランチ名が作業単位のままなので、運用が続くと確実に事故る）

### デプロイ

| | URL |
| --- | --- |
| 本番 | `https://www.vitality-design.jp/` （= `media-alpha-eight.vercel.app`） |
| プレビュー | push ごとに Vercel が自動生成。`media-git-<branch>-<account>.vercel.app` |

push すると Vercel が自動でデプロイする。CI でのビルドステップはない。

---

## 3. ディレクトリ

```
index.html              日本語版。★ ここだけが手で編集する唯一のページ
en/index.html           英語版   ── 自動生成。手で触らない
zh/index.html           中国語版 ── 自動生成。手で触らない

assets/site.css         全3言語で共有する CSS（デザイントークンもここ）
assets/site.js          全3言語で共有する JS

tools/i18n/             en・zh の生成ツール（→ 4節）
tools/verify/           表示チェック（→ 5節）

llms.txt                LLM 向けの会社説明。index.html と内容を揃えること
sitemap.xml             3言語の hreflang 付き
robots.txt
vercel.json             リダイレクト18本・リライト7本（旧 URL の救済）
og.png / og-en.png / og-zh.png   OGP 画像（1200×630）

blog/                   記事38本。別系統。→ 7節
scripts/                blog の記事生成 CLI。→ 7節
agent.html, service.html, company.html, client-work.html, ...
                        過去の事業ページ。トップから導線なし。→ 7節
```

---

## 4. 多言語（ここだけは仕組みを知る必要がある）

**`/en/` と `/zh/` は生成物。直接編集しても次のビルドで消える。**

```
index.html ──┬─► tools/i18n/build.py ──► en/index.html
             │                        └─► zh/index.html
             └─ tools/i18n/tables.py（対訳テーブル）
                tools/i18n/jsonld.json（構造化データの各言語本文）
```

### 日本語を直したら

```bash
# 1. index.html を編集
# 2. 文言を変えた／増やしたなら tools/i18n/tables.py に対訳を足す
# 3. 生成
python3 tools/i18n/build.py
```

出力例:

```
en -> en/index.html  未翻訳 0件
zh -> zh/index.html  未翻訳 0件
```

**未翻訳が1件でもあれば exit 1 で落ち、該当文字列を一覧表示する。**
その文字列を `tables.py` に追記して再実行すればよい。

### 仕組み

`tables.py` の `TEXT` は `(日本語, English, 中文)` の3つ組のリスト。
ビルダーは HTML のテキストノード（`>...<` に挟まれた部分）を**完全一致**で置換する。
短い語が長い文の一部を壊さないよう、**長い文字列から順に**置換している。

そのため **日本語の原文を1文字でも変えたら `tables.py` 側も同じ文字列に直す必要がある**。
直し忘れは「未翻訳」として検出されるので、黙って壊れることはない。

ビルダーが言語ごとに差し替えるのは以下:

- `<html lang>` / `<title>` / meta description / OGP / canonical / OGP 画像
- Google Fonts の URL と、フォント差し替え用の `<style>`（英語は欧文セリフ、中国語は Noto SC）
- `window.VD_S`（`assets/site.js` が読むフォームのエラーメッセージ等）
- 言語スイッチャの現在地
- JSON-LD の本文（`jsonld.json`）
- 本文テキストと属性値（`tables.py`）

### 言語を増やすには

1. `tables.py` の各タプルに4要素目を足す
2. `build.py` の `HEAD` / `FONTS` / `STRINGS` と `jsonld.json` に言語キーを追加
3. `build.py` 末尾の `for lang in ('en','zh')` に追加
4. `index.html` の `<link rel="alternate" hreflang=...>` と言語スイッチャ、`sitemap.xml` にも追記

---

## 5. チェック

```bash
cd tools/verify && npm install && npx playwright install chromium   # 初回のみ
cd ../.. && python3 -m http.server 8237 &
node tools/verify/check.cjs
```

> `package.json` をリポジトリのルートではなく `tools/verify/` に置いてある。
> ルートに置くと Vercel が Node プロジェクトと判定してビルド挙動が変わるおそれがあるため。

3言語 × 9幅（320〜1920px）で以下を見る。1件でも落ちれば exit 1。

- 横スクロールの発生
- 文字の切れ
- 本文のコントラスト比（WCAG AA 4.5:1 / 大きい文字 3:1。半透明背景は祖先まで遡って合成して判定）
- ページ内リンク切れ
- `id` の重複
- JS エラー
- JSON-LD が JSON として妥当か
- 問い合わせフォームの入力検証（未入力・不正メール）

デプロイ済みの URL に対しても実行できる:

```bash
BASE=https://media-git-xxx.vercel.app node tools/verify/check.cjs
```

**CSS を触ったら必ず流すこと。** 暗色セクションに明色用の部品を置く取り違えは、これでしか見つからない。

---

## 6. デザイン

### トークン

`assets/site.css` の `:root` に集約。色を直すならここだけ見ればよい。

```css
--paper:#FAFAF8  --sage:#EFEFEB  --cream:#E6E6E1  --card:#F4F4F0   /* 明色面 */
--navy:#0E0E0D   --navy-2:#191918 --navy-3:#232321                 /* 暗色面 */
--ink:#121211    --ink-2:#4A4A45  --ink-3:#56564F                  /* 明色面の文字 */
--on-d:#F5F5F1   --on-d-2:#B9B9B2 --on-d-3:#8E8E86                 /* 暗色面の文字 */
--gold-t:#6E6045 --gold-2:#D4C7A6                                  /* アクセント */
--terra:#9A4228                                                     /* 必須マーク・エラー */
```

**アクセント色は明暗で別トークンになっている。** `--gold-t` は明色面専用、`--gold-2` は暗色面専用。
取り違えるとコントラストが落ちる。暗色面で `--gold-t` を使うと 2.2:1 まで落ちて AA を割る。

### 書体

- 見出し: `Shippori Mincho`（明朝）
- 本文: `Noto Sans JP`
- 欧文見出し・ロゴ: `Cormorant Garamond`
- 微細ラベル: `Inter`

英語版は見出しが `Cormorant Garamond`、本文が `Inter` に差し替わる（`build.py` の `FONTS`）。

### セクションのトーン

`.sec` に以下のいずれかを付ける。付け替えたら必ず 5節のチェックを流すこと。

| クラス | 背景 |
| --- | --- |
| `.pp` | `--paper` |
| `.sg` | `--sage` |
| `.cr` | `--cream` |
| `.nv` | `--navy`（暗色） |

### アニメーション

`.r` / `.r-s` / `.ln` に IntersectionObserver で `.in` を付けてフェードインさせる。
`[data-stagger]` を親に付けると子の `.r-s` に遅延が順に入る。

JS 無効時と `prefers-reduced-motion: reduce` では全要素が最初から表示される（CSS 側で担保）。

### 画像

**写真は1枚もない。** 客室ビジュアルは `index.html` 冒頭の `<symbol id="roomart">` に書いた
抽象的な SVG（ぼかした光と靄）で、`<use href="#roomart">` で参照している。

写真を入れる場合は `<svg><use href="#roomart"/></svg>` を `<img>` に置き換える。
**その際も `.art-tag`（「コンセプトイメージ／実在する施工事例ではありません」）は外さないこと。** → 8節

---

## 7. 別系統のもの

### blog/

記事38本。`scripts/generate-article.mjs` が GitHub Actions（`.github/workflows/generate-article.yml`）
から呼ばれて、記事を**ドラフト PR として**作る。直接デプロイはしない。詳細は `scripts/README.md`。

**コーポレートサイト本体とは独立している。** `tools/i18n` の対象外。

なお **38本すべてに旧サービス名「His Recoveries」が残っている**（`grep -rl "His Recoveries" blog/`）。
現在の事業とは無関係なので、公開を続けるなら一括置換か非公開化の判断が要る。

### 過去の事業ページ

`agent.html` `service.html` `company.html` `client-work.html` `hiring.html` `backoffice.html`
`estimate.html` `handover.html` `monthly-report.html` ほか。

いずれも**過去の事業領域のページ**で、現在のトップページからは導線がない。
URL が生きているだけで、今の事業を説明していない。

**まだ消すか残すかの判断がされていない。** 判断したら、消すか `vercel.json` の `redirects` に足す。

---

## 8. 記載内容のルール（必ず読む）

このサイトには**まだ実績がない**。以下は事故防止のための明示的な取り決めで、
文言を触る人は守る必要がある。

やってはいけないこと:

- 導入企業名・顧客ロゴ・レビュー・売上・顧客数・資金調達実績を載せる（**実在しないため**）
- 代表が宿泊業界の出身であるように読める書き方をする（**出身ではない**）
- ADR や稼働率の改善を、実証済みの成果として書く（**実証していない**）
- `Experience OS` を提供中の製品として書く（**構想段階**）
- 客室ビジュアルを施工事例として見せる（**コンセプトイメージ**）

現在サイトに入っている打ち消し表現:

| 場所 | 文言 |
| --- | --- |
| 04 CURRENT FOCUS | 「ホテル専門の会社ではありません。最初の起点として選んでいる領域です。」 |
| 04（One Room） | 「コンセプト段階の実験プロジェクトであり、Vitality Design そのものではありません。現時点で実証済みの成果はありません。」 |
| 05 TECHNOLOGY | 「これは構想であり、完成した製品として提供している段階ではありません。」 |
| 08 COMPANY | 「宿泊業界の出身ではありません。宿泊領域での実績は、現時点で実証済みのものとして扱っていません。」 |
| 画像 | 「コンセプトイメージ／実在する施工事例ではありません」 |

**これらを消す場合は、消してよい事実があることを確認してから消すこと。**

---

## 9. ページ構成

`index.html` は9セクション。PC で約11.7画面、スマートフォンで約12.0画面。

| | セクション | 内容 |
| --- | --- | --- |
| — | HERO | そこでしかできない体験を創る。 |
| 01 | WHY WE EXIST | 場所には、まだ価値が眠っている。 |
| 02 | OUR PURPOSE | 循環の7段階 ＋ 社会的意義4点 |
| 03 | WHAT WE DO | DISCOVER / CONNECT / CREATE / EVOLVE ＋ 創るものの例 |
| 04 | CURRENT FOCUS | We start with hospitality. ＋ One Room Project |
| 05 | TECHNOLOGY | Technology should disappear into the experience. |
| 06 | GLOBAL | Made locally. Connected globally. |
| 07 | PARTNERSHIP | Build Together. |
| 08 | COMPANY | 会社概要・代表プロフィール |
| 09 | CONTACT | 問い合わせフォーム |

問い合わせは **Formspree**（`https://formspree.io/f/xbdvobba`）へ POST。
`assets/site.js` が `fetch` で送り、成功時は `#fwrap` に `.sent` を付けて完了文面に差し替える。
JS 無効時は通常のフォーム送信にフォールバックする。

アクセス解析は **GA4**（`G-DWTE9DWQ0S`）。`data-cta` 属性の付いた要素のクリックを
`cta_click` イベントとして送っている。

---

## 10. 未対応

| 項目 | 状況 |
| --- | --- |
| `main` ブランチ | **ない。** 要整理（2節） |
| 会社概要の「設立」 | **設立年月が不明のため項目ごと外してある。** 確認でき次第 `index.html` の `.corp` に追加 |
| 写真 | **1枚もない。** 抽象 SVG で代替中（6節） |
| 過去の事業ページ | 削除／リダイレクトの判断待ち（7節） |
| `blog/` の記載 | **38本すべてに旧サービス名「His Recoveries」が残っている。** 現在の事業と無関係 |
