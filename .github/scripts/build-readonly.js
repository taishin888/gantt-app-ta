'use strict';
const fs   = require('fs');
const path = require('path');

// ── 環境変数から設定を取得（GitHub Actionsが渡す） ──
const REPO   = process.env.GITHUB_REPOSITORY || '';
const BRANCH = process.env.GITHUB_DEPLOY_BRANCH || 'main';
// TOKEN は GitHub Secrets の GANTT_READ_TOKEN から（読み取り専用PAT）
const TOKEN  = process.env.GANTT_READ_TOKEN || '';

console.log('[build] REPO:', REPO || '(not set)');
console.log('[build] BRANCH:', BRANCH);
console.log('[build] TOKEN:', TOKEN ? `SET (len=${TOKEN.length})` : '(not set)');

// ── ファイル読み込み ──
console.log('[build] Reading index.html ...');
const html = fs.readFileSync('index.html', 'utf8');

console.log('[build] Reading data/tasks.json ...');
const data = JSON.parse(fs.readFileSync('data/tasks.json', 'utf8'));
const orig = data.settings || {};

console.log('[build] tasks:',    (data.tasks      || []).length,
            '/ groups:',         (data.groups     || []).length,
            '/ members:',        (data.members    || []).length,
            '/ milestones:',     (data.milestones || []).length);

// トークンを除去した安全なデータ
const safeData = {
  ...data,
  settings: { ...orig, token: '', ghToken: '' }
};
const dataJson = JSON.stringify(safeData, null, 2);

// ── 共通置換処理 ──
function buildHtml(src, readonly) {
  let out = src;

  // 1. データブロック置換
  const dataBlockRe = /\/\/ __GANTT_DATA_START__[\s\S]*?\/\/ __GANTT_DATA_END__/;
  if (!dataBlockRe.test(out)) {
    console.error('[build] ERROR: __GANTT_DATA_START__ marker not found');
    process.exit(1);
  }
  out = out.replace(
    dataBlockRe,
    '// __GANTT_DATA_START__\nlet DATA = ' + dataJson + ';\n// __GANTT_DATA_END__'
  );

  // 2. READONLY フラグ
  if (out.includes('// __READONLY_FLAG__')) {
    out = out.replace(
      /const READONLY = \w+;  ?\/\/ __READONLY_FLAG__/,
      readonly
        ? 'const READONLY = true;  // __READONLY_FLAG__'
        : 'const READONLY = false; // __READONLY_FLAG__'
    );
  }

  // 3. GitHub 設定埋め込み（編集版・閲覧版ともに埋め込む）
  const cfgBlockRe = /\/\/ __GITHUB_CONFIG_START__[\s\S]*?\/\/ __GITHUB_CONFIG_END__/;
  if (cfgBlockRe.test(out) && REPO) {
    const cfgBlock = `// __GITHUB_CONFIG_START__
const GITHUB_REPO   = '${REPO}';   // __GITHUB_REPO__
const GITHUB_TOKEN  = '${TOKEN}';  // __GITHUB_TOKEN__
const GITHUB_BRANCH = '${BRANCH}'; // __GITHUB_BRANCH__
// __GITHUB_CONFIG_END__`;
    out = out.replace(cfgBlockRe, cfgBlock);
    console.log('[build] GitHub config embedded:', REPO);
  } else if (!REPO) {
    console.warn('[build] WARNING: GITHUB_REPOSITORY not set — config not embedded');
  }

  return out;
}

// ── _site ディレクトリ作成 ──
fs.mkdirSync('_site', { recursive: true });
fs.mkdirSync(path.join('_site', 'data'), { recursive: true });

// ── viewer.html（閲覧専用） ──
const viewer = buildHtml(html, true);
const viewerPath = path.join('_site', 'viewer.html');
fs.writeFileSync(viewerPath, viewer, 'utf8');
console.log('[build] Generated viewer.html:', viewer.length, 'bytes');

// ── index.html（編集版・GitHub設定埋め込み済み） ──
const editor = buildHtml(html, false);
const editorPath = path.join('_site', 'index.html');
fs.writeFileSync(editorPath, editor, 'utf8');
console.log('[build] Generated index.html:', editor.length, 'bytes');

// ── data フォルダをコピー ──
for (const f of fs.readdirSync('data')) {
  fs.copyFileSync(path.join('data', f), path.join('_site', 'data', f));
}

console.log('[build] Done.');
console.log('[build] viewer URL: viewer.html (READONLY=true, data embedded)');
console.log('[build] editor URL: index.html  (READONLY=false, config embedded)');
