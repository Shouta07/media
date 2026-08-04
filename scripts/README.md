# Vitality Notes 記事生成パイプライン

AIで記事の**下書きを生成 → 人がレビュー → デプロイ**する仕組みです。
生成は自動、公開は**必ず人の承認（PRマージ）**を通します。直接デプロイはしません。

## 仕組み

```
テーマを入力（GitHub Actions）
   ↓
Claude が構造化データで記事を生成（既存12記事のスタイル・SEO/GEO構成に準拠）
   ↓
決定的にHTMLを組み立て（JSON-LD @graph / メタ / TLDR / 目次 / FAQ）
   ↓
自動チェック（JSON-LD妥当性・必須メタ・内部リンク整合・slug重複・医療広告/景表法の禁止表現）
   ↓
Pull Request を自動作成（＝人のレビュー必須ゲート）
   ↓
あなたがPRを確認・修正してマージ ＝ Vercel が公開
```

- HTMLは**テンプレートから決定的に組み立てる**ため、構造化データは常に正しく生成されます。
  モデルは本文の中身（見出し・段落・FAQ・関連記事の選択）だけを担当します。
- 記事を書くと同時に、`blog/index.html`（カード＋Blog JSON-LD）・`sitemap.xml`・`llms.txt` も更新されます。

## セットアップ（1回だけ）

1. **Anthropic APIキーをリポジトリSecretに`ANTHROPIC_API_KEY`として登録**
   GitHub → Settings → Secrets and variables → Actions → New repository secret
   （キーは https://console.anthropic.com で発行）

2. **Actions にPR作成を許可**
   GitHub → Settings → Actions → General → 「Workflow permissions」で
   **"Allow GitHub Actions to create and approve pull requests"** にチェック。

3. 以上で完了。ワークフローは `.github/workflows/generate-article.yml` に入っています。

## 使い方（記事を作る）

GitHub → **Actions** タブ → 「Generate Vitality Notes article」→ **Run workflow** →
- **topic**（必須）：記事テーマ
- **keywords**（任意）：狙いたい検索キーワード
- **notes**（任意）：補足メモ

実行すると `article/<slug>` ブランチにPRが作成されます。
PRを開き、Vercelプレビューで表示を確認し、内容に問題がなければ**マージ＝公開**。

## ローカルで試す（任意）

```bash
cd scripts
npm install
ANTHROPIC_API_KEY=sk-ant-... node generate-article.mjs "記事テーマ" --keywords "予約,リマインド"
# 生成された記事を検証
node validate-cli.mjs <slug>
```

## 人が必ず確認すべきこと

自動チェックは**構造と禁止表現の機械的スキャン**までです。次は人が判断します：

- 事実・数値・事例が**捏造されていないか**、誇張がないか
- 医療広告ガイドライン上の表現として適切か
- 既存記事との内容重複・トーンのズレがないか

## ファイル

| ファイル | 役割 |
|---|---|
| `generate-article.mjs` | 生成のエントリポイント（Claude呼び出し→組み立て→検証） |
| `lib/render.mjs` | 構造化データ → HTML の決定的組み立て |
| `lib/site.mjs` | 既存記事の読み取り・index/sitemap/llms の更新 |
| `lib/validate.mjs` | 自動チェック（JSON-LD・メタ・リンク・禁止表現） |
| `validate-cli.mjs` | 既存記事を単体検証するCLI |
