'use strict';
const fs   = require('fs');
const path = require('path');

// ── ファイル読み込み ──
console.log('[build] Reading index.html ...');
const html = fs.readFileSync('index.html', 'utf8');

console.log('[build] Reading data/tasks.json ...');
const raw  = fs.readFileSync('data/tasks.json', 'utf8');
const data = JSON.parse(raw);

console.log('[build] tasks:', (data.tasks  || []).length,
            '/ groups:', (data.groups || []).length,
            '/ members:', (data.members || []).length);

// settings が存在しない場合のデフォルト
const orig = data.settings || {};

// トークンを除去した安全なデータ（キー名は tasks.json に合わせる）
const safeData = {
  ...data,
  settings: {
    ...orig,
    token:   '',   // PAT を除去
    ghToken: '',   // 旧キー名も念のため除去
  }
};

const dataJson = JSON.stringify(safeData, null, 2);

// ── マーカー置換 ──
const dataBlockRe = /\/\/ __GANTT_DATA_START__[\s\S]*?\/\/ __GANTT_DATA_END__/;

if (!dataBlockRe.test(html)) {
  console.error('[build] ERROR: __GANTT_DATA_START__ marker not found in index.html');
  console.error('[build] Make sure index.html contains the markers.');
  process.exit(1);
}

let out = html.replace(
  dataBlockRe,
  '// __GANTT_DATA_START__\nlet DATA = ' + dataJson + ';\n// __GANTT_DATA_END__'
);

// ── READONLY フラグ ──
if (out.includes('// __READONLY_FLAG__')) {
  out = out.replace(
    /const READONLY = false; \/\/ __READONLY_FLAG__/,
    'const READONLY = true;  // __READONLY_FLAG__'
  );
  console.log('[build] READONLY flag set to true');
} else {
  console.warn('[build] WARNING: __READONLY_FLAG__ not found. Readonly mode may not work.');
}

// ── 出力 ──
fs.mkdirSync('_site', { recursive: true });
const outPath = path.join('_site', 'index.html');
fs.writeFileSync(outPath, out, 'utf8');
console.log('[build] Generated:', outPath, '(' + out.length + ' bytes)');

// data フォルダをコピー
fs.mkdirSync(path.join('_site', 'data'), { recursive: true });
for (const f of fs.readdirSync('data')) {
  fs.copyFileSync(path.join('data', f), path.join('_site', 'data', f));
}
console.log('[build] Done.');
