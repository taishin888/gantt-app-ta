'use strict';
const fs   = require('fs');
const path = require('path');

// ── ファイル読み込み ──
console.log('[build] Reading index.html ...');
const html = fs.readFileSync('index.html', 'utf8');

console.log('[build] Reading data/tasks.json ...');
const data = JSON.parse(fs.readFileSync('data/tasks.json', 'utf8'));

console.log('[build] tasks:',   (data.tasks   || []).length,
            '/ groups:',  (data.groups  || []).length,
            '/ members:', (data.members || []).length);

// settings が存在しない場合のデフォルト
const orig = data.settings || {};

// トークンを除去した安全なデータ
const safeData = {
  ...data,
  settings: { ...orig, token: '', ghToken: '' }
};

const dataJson = JSON.stringify(safeData, null, 2);

// ── マーカー置換 ──
const dataBlockRe = /\/\/ __GANTT_DATA_START__[\s\S]*?\/\/ __GANTT_DATA_END__/;
if (!dataBlockRe.test(html)) {
  console.error('[build] ERROR: __GANTT_DATA_START__ marker not found in index.html');
  process.exit(1);
}

let viewer = html.replace(
  dataBlockRe,
  '// __GANTT_DATA_START__\nlet DATA = ' + dataJson + ';\n// __GANTT_DATA_END__'
);

// ── READONLY フラグ ──
if (viewer.includes('// __READONLY_FLAG__')) {
  viewer = viewer.replace(
    /const READONLY = false; \/\/ __READONLY_FLAG__/,
    'const READONLY = true;  // __READONLY_FLAG__'
  );
  console.log('[build] READONLY flag set to true');
} else {
  console.warn('[build] WARNING: __READONLY_FLAG__ not found.');
}

// ── _site ディレクトリ作成 ──
fs.mkdirSync('_site', { recursive: true });

// ── viewer.html（閲覧専用・データ埋め込み済み）を出力 ──
const viewerPath = path.join('_site', 'viewer.html');
fs.writeFileSync(viewerPath, viewer, 'utf8');
console.log('[build] Generated viewer:', viewerPath, '(' + viewer.length + ' bytes)');

// ── index.html（編集版）をそのままコピー ──
const editorPath = path.join('_site', 'index.html');
fs.copyFileSync('index.html', editorPath);
console.log('[build] Copied editor:', editorPath);

// ── data フォルダをコピー ──
fs.mkdirSync(path.join('_site', 'data'), { recursive: true });
for (const f of fs.readdirSync('data')) {
  fs.copyFileSync(path.join('data', f), path.join('_site', 'data', f));
}
console.log('[build] Done.');
console.log('[build] viewer URL: /viewer.html');
console.log('[build] editor URL: /index.html');
