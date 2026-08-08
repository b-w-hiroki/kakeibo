/*
 * index.html の軽量チェック。依存パッケージなし・Node 標準のみで動く。
 *
 *  1. インライン <script> が JS として構文エラーなくパースできるか
 *     （壊れた JS を push すると公開サイトが真っ白になるため、これが一番効く）
 *  2. localStorage の kakeibo_* キーがすべて BACKUP_KEYS に入っているか
 *     （CLAUDE.md の「キーを追加したら BACKUP_KEYS にも足すこと」の機械化）
 *  3. 外部から読み込むホストが CSP の許可リストに収まっているか
 *
 * 実行: node .github/scripts/check.mjs
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const FILE = 'index.html';
const html = readFileSync(FILE, 'utf8');
const errors = [];

/* 行番号を出すためのヘルパ */
const lineOf = (index) => html.slice(0, index).split('\n').length;

/* ---- 1. インライン script の構文チェック ---- */
const scriptRe = /<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g;
let m, scriptCount = 0;
while ((m = scriptRe.exec(html)) !== null) {
  scriptCount++;
  const body = m[2];
  const startLine = lineOf(m.index);
  try {
    // 実行はせず、パースだけさせる
    new vm.Script(body, { filename: `${FILE} (inline script @L${startLine})` });
  } catch (e) {
    errors.push(`[JS構文] ${FILE}:${startLine} 付近のインラインスクリプト: ${e.message}`);
  }
}
if (scriptCount === 0) errors.push('[JS構文] インライン <script> が 1 つも見つかりません。抽出ロジックが壊れている可能性があります。');

/* ---- 2. localStorage キーが BACKUP_KEYS に登録されているか ---- */
const backupDecl = html.match(/const BACKUP_KEYS\s*=\s*\[([\s\S]*?)\]/);
if (!backupDecl) {
  errors.push('[BACKUP_KEYS] 宣言が見つかりません。');
} else {
  const declared = new Set([...backupDecl[1].matchAll(/'([^']+)'/g)].map(x => x[1]));
  const used = new Map(); // key -> 最初に現れた行
  const keyRe = /localStorage\.(?:getItem|setItem|removeItem)\(\s*'(kakeibo_[a-zA-Z0-9_]+)'/g;
  let k;
  while ((k = keyRe.exec(html)) !== null) {
    if (!used.has(k[1])) used.set(k[1], lineOf(k.index));
  }
  for (const [key, line] of used) {
    if (!declared.has(key)) {
      errors.push(`[BACKUP_KEYS] '${key}' (${FILE}:${line}) が BACKUP_KEYS に登録されていません。バックアップ／復元から漏れます。`);
    }
  }
}

/* ---- 3. 外部ホストが CSP の許可リストに収まっているか ---- */
const cspMeta = html.match(/<meta\s+http-equiv=["']Content-Security-Policy["']\s+content="([\s\S]*?)"/i);
if (!cspMeta) {
  errors.push('[CSP] Content-Security-Policy の <meta> が見つかりません。');
} else {
  const allowed = new Set([...cspMeta[1].matchAll(/https:\/\/([a-z0-9.-]+)/gi)].map(x => x[1].toLowerCase()));
  const refRe = /<(?:script|link)\b[^>]*\b(?:src|href)=["']https:\/\/([a-z0-9.-]+)/gi;
  let r;
  while ((r = refRe.exec(html)) !== null) {
    const host = r[1].toLowerCase();
    if (!allowed.has(host)) {
      errors.push(`[CSP] ${FILE}:${lineOf(r.index)} が https://${host} を読み込んでいますが CSP で許可されていません。ブラウザにブロックされます。`);
    }
  }
  // Google Fonts の CSS は fonts.gstatic.com からフォント本体を取りに行く
  if (allowed.has('fonts.googleapis.com') && !allowed.has('fonts.gstatic.com')) {
    errors.push('[CSP] fonts.googleapis.com を許可していますが font-src に fonts.gstatic.com がありません。フォントが読み込めません。');
  }
}

/* ---- 結果 ---- */
if (errors.length) {
  console.error(`✕ ${errors.length} 件の問題が見つかりました\n`);
  errors.forEach(e => console.error('  ' + e));
  process.exit(1);
}
console.log(`✓ インラインスクリプト ${scriptCount} 件の構文 OK / BACKUP_KEYS OK / CSP 許可ホスト OK`);
