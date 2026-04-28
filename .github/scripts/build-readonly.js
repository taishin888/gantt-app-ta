'use strict';
const fs = require('fs');
const path = require('path');

// ── ファイル読み込み ──
const html = fs.readFileSync('index.html', 'utf8');
const data = JSON.parse(fs.readFileSync('data/tasks.json', 'utf8'));

// トークンは閲覧専用HTMLに含めない（セキュリティ）
const safeData = {
  ...data,
  settings: {
    ...data.settings,
    token: '',   // トークンを除去
    repo:  data.settings.repo  || '',
    branch: data.settings.branch || 'main',
  }
};

const dataJson = JSON.stringify(safeData, null, 2);

// ── __GANTT_DATA_START__ ～ __GANTT_DATA_END__ を実データで置き換え ──
const dataBlockRe = /\/\/ __GANTT_DATA_START__[\s\S]*?\/\/ __GANTT_DATA_END__/;
const newDataBlock = `// __GANTT_DATA_START__
let DATA = ${dataJson};
// __GANTT_DATA_END__`;

if (!dataBlockRe.test(html)) {
  console.error('ERROR: __GANTT_DATA_START__ marker not found in index.html');
  process.exit(1);
}

let out = html.replace(dataBlockRe, newDataBlock);

// ── READONLY フラグを true に ──
out = out.replace(
  /const READONLY = false; \/\/ __READONLY_FLAG__/,
  'const READONLY = true;  // __READONLY_FLAG__'
);

// ── 出力 ──
const outPath = path.join('_site', 'index.html');
fs.mkdirSync('_site', { recursive: true });
fs.writeFileSync(outPath, out, 'utf8');

// 他の必要ファイルもコピー（dataフォルダなど）
// ※ .githubフォルダは除外
function copyDir(src, dest, excludes = []) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (excludes.includes(entry.name)) continue;
    const srcPath  = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath, excludes);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// data フォルダをコピー（tasks.json を公開しても問題なし）
copyDir('data', path.join('_site', 'data'));

console.log('Generated: ' + outPath);
console.log('Data embedded: ' + safeData.tasks.length + ' tasks, ' + safeData.groups.length + ' groups');
