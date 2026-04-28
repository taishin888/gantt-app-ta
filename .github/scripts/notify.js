'use strict';
const fs    = require('fs');
const https = require('https');

// ── データ読み込み ──
const data   = JSON.parse(fs.readFileSync('data/tasks.json', 'utf8'));
const now    = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
const commit = (process.env.GITHUB_SHA || 'unknown').slice(0, 7);
const repo   = process.env.GITHUB_REPOSITORY || '';
const base   = repo
  ? 'https://' + repo.split('/')[0] + '.github.io/' + repo.split('/')[1]
  : '';
// 閲覧専用ページURL
const viewerUrl = base ? base + '/viewer.html' : '';
// 編集版ページURL
const editorUrl = base ? base + '/index.html'  : '';

// ── 集計 ──
const total = data.tasks.length;
const doing = data.tasks.filter(t => t.status === 'doing').length;
const done  = data.tasks.filter(t => t.status === 'done').length;
const todo  = data.tasks.filter(t => t.status === 'todo').length;

// ── 担当者マップ ──
const memberMap = {};
(data.members || []).forEach(m => { memberMap[m.name] = m; });

// ── メンション付き行の生成 ──
const mentionEntities = [];
const mentionRows     = [];

data.tasks
  .filter(t => t.status !== 'done')
  .forEach(task => {
    const member = memberMap[task.owner] || {};
    const email  = member.email || null;
    const name   = task.owner  || '未設定';

    if (email) {
      mentionEntities.push({
        type: 'mention',
        text: '<at>' + name + '</at>',
        mentioned: { id: email, name: name }
      });
      mentionRows.push({
        type: 'TextBlock',
        text: '<at>' + name + '</at>　' + task.name + '　期日: ' + task.end,
        wrap: true,
        spacing: 'Small'
      });
    } else {
      mentionRows.push({
        type: 'TextBlock',
        text: '👤 ' + name + '　' + task.name + '　期日: ' + task.end,
        wrap: true,
        spacing: 'Small'
      });
    }
  });

// ── Adaptive Card 組み立て ──
const cardBody = [
  {
    type: 'TextBlock',
    text: '📊 ガントチャートが更新されました',
    weight: 'Bolder',
    size: 'Medium',
    color: 'Accent'
  },
  {
    type: 'FactSet',
    facts: [
      { title: '更新日時',   value: now },
      { title: 'コミット',   value: commit },
      { title: '総タスク数', value: String(total) },
      { title: '進行中',     value: String(doing) },
      { title: '完了済み',   value: String(done)  },
      { title: '未着手',     value: String(todo)  }
    ]
  },
  {
    type: 'TextBlock',
    text: '担当タスク一覧',
    weight: 'Bolder',
    spacing: 'Medium',
    separator: true
  }
].concat(mentionRows);

// ── アクションボタン（閲覧専用のみ表示） ──
const actions = [];
if (viewerUrl) {
  actions.push({
    type: 'Action.OpenUrl',
    title: '📋 ガントチャートを見る（閲覧専用）',
    url: viewerUrl
  });
}

const card = {
  type: 'AdaptiveCard',
  version: '1.4',
  msteams: { entities: mentionEntities },
  body: cardBody,
  actions: actions
};

const payload = JSON.stringify({
  type: 'message',
  attachments: [{
    contentType: 'application/vnd.microsoft.card.adaptive',
    content: card
  }]
});

// ── 送信 ──
const webhook = process.env.TEAMS_WEBHOOK;
if (!webhook) {
  console.log('TEAMS_WEBHOOK not set. Skipping.');
  process.exit(0);
}

console.log('Sending to Teams... viewer:', viewerUrl);

const u = new URL(webhook);
const req = https.request({
  hostname: u.hostname,
  path:     u.pathname + u.search,
  method:   'POST',
  headers: {
    'Content-Type':   'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
}, res => {
  let raw = '';
  res.on('data', d => raw += d);
  res.on('end', () => {
    console.log('Teams HTTP status:', res.statusCode);
    if (res.statusCode >= 300) {
      console.error('Response body:', raw);
      process.exit(1);
    }
    console.log('Notification sent successfully.');
  });
});
req.on('error', e => { console.error('Request error:', e.message); process.exit(1); });
req.write(payload);
req.end();
