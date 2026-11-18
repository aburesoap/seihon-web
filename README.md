# Seihon（製本）

PDF や画像ファイルを読み込み、**1つの HTML ファイルの「本」** にまとめる静的 Web ツールです。
できあがった HTML はオフラインでも開け、ブラウザだけで本のように読めます。

- 同人誌即売会のサンプル、資料のとりまとめ、マニフェストの頒布などを想定しています
- 処理はすべてブラウザ内で行います。ファイルがサーバーに送られることはありません（運営のサーバー代ゼロ）
- GitHub Pages で公開しています: <https://aburesoap.github.io/seihon/>
- オープンソース（MIT License）。無料で使え、自由に改善できます

> English: Seihon binds PDFs and images into a single, self-contained HTML book that can be read offline in any modern browser. Everything happens locally in your browser.

## できること

### 製本する人

- PDF・画像（PNG / JPEG / WebP / GIF / AVIF / BMP）をまとめて選択、ドラッグ＆ドロップ、または貼り付けで追加
- ドラッグでページを並び替え、削除、白紙ページの追加（ページの後ろに挿入も可）
- 名前・追加順・サイズで並び替え（もう一度クリックで昇順／降順が入れ替わる。白紙ページは直前のページと一緒に移動）
- ページを選んで目次を作成、特定のページにしおり（注目マーカー）を付ける
- 右綴じ（左へ進む）／左綴じ（右へ進む）
- 見開き／単ページ／画面の幅に合わせて自動、表紙の単独表示オンオフ
- ページ一覧は綴じ方向と表紙の設定に合わせて見開きの組で表示（のどの線つき）
- 奥付（作品名、著者名、サークル、発行日、SNS・連絡先、感想 URL、ハッシュタグ、ひとこと）を最終ページとして掲載
- ページ番号の表示・非表示
- パスワードによる暗号化（任意。AES-256-GCM、鍵は PBKDF2-SHA256 で導出）
- 画像は WebP に変換して埋め込み（長辺サイズと画質を選択。WebP を書き出せないブラウザでは JPEG）

作成画面は、表示言語（日本語／英語）、設定パネルの位置（左／右）、テーマ（ライト／ダーク）を切り替えられ、ブラウザに保存されます。
テーマの初期値はブラウザ・端末の設定に従います。

キーボード操作（ページ一覧）: ←→ でページ間を移動、Alt（または Ctrl / ⌘）+ ←→ でページを移動、Delete で削除、M でしおり。

### 読む人

- キーボードの矢印キー、画面の左右タップ（左右 30%）、スワイプ、下部のスライダーでページを移動
- 画面中央のタップで上下の操作バーを隠す／出す
- 目次・しおり一覧: 目次、製本者のしおり（注目マーカー）、自分のしおりから移動
- しおり: 表示中のページに挟む。本ごとにブラウザに保存
- テーマ: ライト／ダーク（初期値はブラウザ・端末の設定）
- 言語: 日本語／英語（ブラウザに保存）

## 使い方

1. <https://aburesoap.github.io/seihon/> を開く
2. PDF や画像をドロップ
3. 「本の設定」「目次・しおり」「奥付」を必要に応じて設定
4. 「書き出し」で「プレビュー」して確認し、「製本してダウンロード」

できあがった `.html` を配布すれば、受け取った人はブラウザで開くだけで読めます。

## 開発

ビルド手順はありません。静的ファイルをそのまま配信します。
PDF の読み込みに ES Modules を使うため、`file://` ではなくローカルサーバー経由で開いてください。

```bash
python3 -m http.server 8000
```

<http://localhost:8000/> を開きます。

### 構成

```
index.html              作成画面
assets/css/app.css      作成画面のスタイル
assets/js/app.js        作成画面のロジック（読み込み・並び替え・書き出し）
assets/js/i18n.js       作成画面の文言（日本語・英語）
assets/js/reader.js     本のリーダー（書き出す HTML に丸ごと埋め込まれる）
assets/vendor/pdfjs/    PDF.js 4.10.38（Apache License 2.0）
```

`reader.js` の `SeihonReader` 関数は `Function.prototype.toString()` で書き出し先の HTML に埋め込まれるため、関数の外側を参照しないように書いています。

### 書き出す HTML の形式

- `<script id="seihon-meta" type="application/json">`: 形式バージョン、本の ID、タイトル、暗号化パラメーター
- `<script id="seihon-payload" type="application/octet-stream">`: Base64 のペイロード
  - 先頭 4 バイト（ビッグエンディアン）が本の情報 JSON の長さ。続いて JSON、その後に各ページの画像バイト列
  - 暗号化時はペイロード全体を AES-GCM で暗号化

### GitHub Pages

リポジトリの Settings → Pages で、`main` ブランチの `/ (root)` を公開元に設定します（`.nojekyll` を同梱）。

## ライセンス

[MIT License](LICENSE) © 2026 aburesoap

同梱している [PDF.js](https://github.com/mozilla/pdf.js) は Apache License 2.0 です（`assets/vendor/pdfjs/LICENSE`）。
フォントは Google Fonts の IBM Plex Sans JP（SIL Open Font License）を読み込みます。オフライン時は端末のフォントで表示されます。
