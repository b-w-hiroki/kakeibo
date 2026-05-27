# 収支ダッシュボード

マネーフォワードME の CSV を読み込んで収支・資産・税金を可視化する Web ツール。GitHub Pages で公開する想定の **単一 HTML ファイル構成**。

## ファイル構成

```
/
├── index.html         全コード（HTML/CSS/JS）が入った単一ファイル ≒ 2300 行
├── CLAUDE.md          このファイル
├── .claude/           Claude Code 用設定
└── files/, files.zip  作業用フォルダ（コミット対象外でよい）
```

GitHub Pages 設定: `master` ブランチの `/`（root）を公開。`index.html` 1 本で動く。ビルドステップなし。

## 技術スタック

- 素の HTML / CSS / JavaScript（フレームワーク・バンドラ・パッケージマネージャなし）
- Chart.js 4.4.1（CDN）
- Google Fonts: Noto Sans JP + DM Mono（CDN）
- 永続化: ブラウザの `localStorage`

依存はすべて CDN なので `npm install` 等は不要。`index.html` をブラウザで開けばそのまま動く。

## 画面構成（4 タブ）

`switchTab(id)` で切り替え。HTML 側は `id="tab-{name}"` の `.panel` で対応。

| タブ | id | 主要機能 |
|------|----|---------|
| ダッシュボード | `tab-dashboard` | 期間フィルタ、月次収支グラフ（棒＋折れ線）、カテゴリランキング、固定/変動費 KPI、前年同月比、資産推移、予算管理 |
| CSV 取り込み | `tab-csv` | マネーフォワード CSV のドロップ読み込み、ファイル管理、月別フィルタ |
| 手動入力 | `tab-manual` | 収入・支出を行単位で入力 |
| 確定申告 | `tab-tax` | 給与所得控除・各種控除・所得税自動計算、CSV から事業所得/医療費を取り込み |

## マネーフォワード ME CSV 仕様

取得: マネーフォワード ME → 収支グラフ → 明細 → CSV ダウンロード。

- 文字コード: **Shift-JIS（cp932）**。`decodeCSV()` が UTF-8 で復号 → 置換文字検出時に shift_jis にフォールバック
- 列: `計算対象 / 日付 / 内容 / 金額（円）/ 保有金融機関 / 大項目 / 中項目 / メモ / 振替 / ID`
- 金額: 支出はマイナス、収入はプラス
- **除外条件**: `振替=1` の行、`計算対象=0` の行

別 CSV として「資産推移」CSV にも対応（`isAssetHistCSV()` で判定して `applyAssetHistData()` に振り分け）。ドロップゾーンは自動判定。

## 内部データモデル

```js
// トランザクション 1 件（processCSV() で正規化）
{
  date:  "2025/01/15",
  name:  "スーパー",
  cat:   "食費",        // 大項目（categoryAliases で別名統合される）
  amt:   -1200,         // 収入=正、支出=負
  type:  "exp",         // "inc" | "exp"
  bank:  "楽天カード",
  month: "2025/01",
}
```

## 状態（トップレベル変数 / localStorage キー）

`index.html` の 835 行目付近にまとまっている。`saveStorage()` で永続化、`loadStorage()` で復元。

| 変数 | 用途 | localStorage キー |
|------|------|-----------------|
| `csvFileMap` | `{ファイル名: トランザクション配列}` | `kakeibo_csv` |
| `manualAssets` | 資産の手動入力行 | `kakeibo_assets` |
| `assetHistory` | 資産推移 CSV のスナップショット配列 | `kakeibo_ah` |
| `manualInc` / `manualExp` | 手動の収入・支出行 | `kakeibo_inc` / `kakeibo_exp` |
| `nextId` | 行 ID 連番 | `kakeibo_nextId` |
| `budgetMap` | カテゴリ別予算 `{cat: 金額}` | `kakeibo_budget` |
| `categoryAliases` | カテゴリ統合エイリアス `{元: 統合先}` | `kakeibo_cat_aliases` |
| `fixedCats` | 固定費カテゴリ `Set` | `kakeibo_fixed_cats`（配列で保存） |

書き込みは `debouncedSave`（400ms）。同期書き込みが必要な箇所だけ `saveStorage()` を直接呼ぶ。

## 主要関数の役割

| 関数 | 役割 |
|------|------|
| `decodeCSV(buffer)` | ArrayBuffer を UTF-8 / Shift-JIS で復号 |
| `parseCSV(text)` / `splitCSVLine(line)` | CSV 文字列をパース（クォート対応） |
| `detectFields(rows)` | ヘッダー名から列インデックスを推定 |
| `processCSV(raw, filename)` | 正規化トランザクション配列に変換、振替/対象外を除外 |
| `loadFiles(files)` | 複数ファイルを `readAsArrayBuffer` で読み込み |
| `applyCSVFilter()` / `getDashRows()` | タブごとのフィルタ適用 |
| `renderBarChart` / `renderLineChart` / `renderCatBars` | Chart.js 描画 |
| `renderFixedVariable` | 固定費 vs 変動費 KPI |
| `renderYoY` | 前年同月比 |
| `renderRecon` | 手動入力 ↔ CSV の照合表 |
| `renderTaxResult` | 確定申告タブ全体の再計算 |
| `calcSalaryDeduction` / `calcLifeDeduction` / `calcSpouseDeduction` / `calcIncomeTax` | 各種税額計算 |
| `printDashboard()` | ダッシュボードを印刷用整形 |

## 開発の流れ

ローカル動作確認:

```
# Windows のエクスプローラから index.html をダブルクリックでもよいし、
# 簡易サーバで開きたければ:
python -m http.server 8000
# → http://localhost:8000/
```

ビルド・テスト・lint は無し。動作確認はブラウザの DevTools で行う。`localStorage` をリセットしたい時は DevTools → Application → Local Storage で `kakeibo_*` を削除。

## 編集時の注意

- **単一ファイル構成を維持する**。GitHub Pages にそのまま置く前提なので、外部 JS/CSS への分割は基本的にしない（要望があれば別途相談）。
- **CDN 以外の依存を増やさない**。npm を引き込むと運用コストが跳ね上がる。
- **localStorage キー名を変えない**。既存ユーザーのデータが消える。スキーマ拡張時は後方互換ロードを `loadStorage()` に入れる。
- **`saveStorage()` の呼び忘れに注意**。UI からデータを変える関数（add/del/upd 系）は必ず保存する。デバウンス版 `debouncedSave` でも可。
- **タブ追加時**: `<div class="tab-bar">` のボタン、対応する `.panel#tab-xxx`、`switchTab` での描画呼び出しの 3 点をセットで更新。
- **金額は内部的に「収入=正、支出=負」で統一**。表示時に `Math.abs()` して符号を付ける（`fmt` / `fmtSgn` ヘルパ）。

## 過去の経緯

- マネーフォワード ME に個人向け API はなく、スクレイピングは規約上不可 → 「CSV をブラウザにドロップ」運用で確定
- Cursor で開発を始めたが Claude Code に移行。旧 `cursor_handoff.md` は廃止
- 一時期 `kakeibo.html` と `index.html` の 2 ファイル運用だったが、GitHub Pages の root 公開のため `index.html` に統一済み
