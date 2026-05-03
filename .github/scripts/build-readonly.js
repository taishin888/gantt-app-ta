'use strict';
const fs   = require('fs');
const path = require('path');

const REPO   = process.env.GITHUB_REPOSITORY || '';
const BRANCH = process.env.GITHUB_DEPLOY_BRANCH || 'main';
const TOKEN  = process.env.GANTT_READ_TOKEN || '';

console.log('[build] REPO:', REPO || '(not set)');
console.log('[build] TOKEN:', TOKEN ? `SET (len=${TOKEN.length})` : '(not set - token embedding skipped)');

// ── ファイル読み込み ──
const html = fs.readFileSync('index.html', 'utf8');
const data = JSON.parse(fs.readFileSync('data/tasks.json', 'utf8'));
const orig = data.settings || {};

console.log('[build] tasks:', (data.tasks||[]).length,
            '/ groups:', (data.groups||[]).length,
            '/ members:', (data.members||[]).length,
            '/ milestones:', (data.milestones||[]).length);

// トークンを除去した安全なデータ
const safeData = {
  ...data,
  settings: { ...orig, token: '', ghToken: '' }
};
const dataJson = JSON.stringify(safeData, null, 2);

function buildHtml(src, readonly) {
  let out = src;

  // 1. データブロック置換
  const dataBlockRe = /\/\/ __GANTT_DATA_START__[\s\S]*?\/\/ __GANTT_DATA_END__/;
  if (!dataBlockRe.test(out)) {
    console.error('[build] ERROR: __GANTT_DATA_START__ marker not found');
    process.exit(1);
  }
  out = out.replace(dataBlockRe,
    '// __GANTT_DATA_START__\nlet DATA = ' + dataJson + ';\n// __GANTT_DATA_END__'
  );

  // 2. READONLY フラグ
  out = out.replace(
    /const READONLY = \w+;  ?\/\/ __READONLY_FLAG__/,
    readonly ? 'const READONLY = true;  // __READONLY_FLAG__'
             : 'const READONLY = false; // __READONLY_FLAG__'
  );

  // 3. GitHub設定埋め込み（TOKENがある場合のみ）
  const cfgRe = /\/\/ __GITHUB_CONFIG_START__[\s\S]*?\/\/ __GITHUB_CONFIG_END__/;
  if (cfgRe.test(out) && REPO && TOKEN) {
    out = out.replace(cfgRe,
      `// __GITHUB_CONFIG_START__\n` +
      `const GITHUB_REPO   = '${REPO}';   // __GITHUB_REPO__\n` +
      `const GITHUB_TOKEN  = '${TOKEN}';  // __GITHUB_TOKEN__\n` +
      `const GITHUB_BRANCH = '${BRANCH}'; // __GITHUB_BRANCH__\n` +
      `// __GITHUB_CONFIG_END__`
    );
    console.log('[build] GitHub config embedded');
  } else {
    console.log('[build] GitHub config NOT embedded (REPO or TOKEN missing)');
  }

  return out;
}

// ── 出力 ──
fs.mkdirSync('_site', { recursive: true });
fs.mkdirSync(path.join('_site', 'data'), { recursive: true });

// viewer.html（閲覧専用）
const viewer = buildHtml(html, true);
fs.writeFileSync(path.join('_site', 'viewer.html'), viewer);
console.log('[build] viewer.html:', viewer.length, 'bytes (READONLY=true)');

// index.html（編集版）
const editor = buildHtml(html, false);
fs.writeFileSync(path.join('_site', 'index.html'), editor);
console.log('[build] index.html:', editor.length, 'bytes (READONLY=false)');

// data/tasks.json（トークン除去済み）
fs.writeFileSync(
  path.join('_site', 'data', 'tasks.json'),
  JSON.stringify(safeData, null, 2)
);
console.log('[build] data/tasks.json written (token stripped)');

// members.xlsxがあればコピー
if (fs.existsSync(path.join('data', 'members.xlsx'))) {
  fs.copyFileSync(path.join('data', 'members.xlsx'), path.join('_site', 'data', 'members.xlsx'));
  console.log('[build] members.xlsx copied');
}

console.log('[build] All done.');
