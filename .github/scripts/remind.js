'use strict';
const fs    = require('fs');
const https = require('https');

// ── データ読み込み ──
const data = JSON.parse(fs.readFileSync('data/tasks.json', 'utf8'));

// 今日 (JST)
const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
now.setHours(0, 0, 0, 0);

const settings    = data.settings || {};
const remindDaysA = parseInt(settings.r1) || 3;
const remindDaysB = parseInt(settings.r2) || 1;

// ── 担当者マップ ──
const memberMap = {};
(data.members || []).forEach(m => { memberMap[m.name] = m; });

// ── 期限チェック ──
function getTasksDueIn(days) {
  return data.tasks.filter(t => {
    if (t.status === 'done') return false;
    const end = new Date(t.end + 'T00:00:00');
    return Math.round((end - now) / 86400000) === days;
  });
}

const tasksToday = getTasksDueIn(0);
const tasks1     = getTasksDueIn(remindDaysB);
const tasks3     = getTasksDueIn(remindDaysA);

if (!tasksToday.length && !tasks1.length && !tasks3.length) {
  console.log('No reminders today. Skipping.');
  process.exit(0);
}

// ── メンションエンティティと行の生成 ──
const mentionEntities = [];
const usedEmails      = new Set();

function buildRows(tasks, icon, label) {
  if (!tasks.length) return [];
  const rows = [];
  rows.push({
    type: 'TextBlock',
    text: icon + ' **' + label + '**',
    weight: 'Bolder',
    spacing: 'Medium',
    separator: true
  });
  tasks.forEach(task => {
    const member = memberMap[task.owner] || {};
    const email  = member.email || null;
    const name   = task.owner  || '未設定';

    if (email && !usedEmails.has(email)) {
      usedEmails.add(email);
      mentionEntities.push({
        type: 'mention',
        text: '<at>' + name + '</at>',
        mentioned: { id: email, name: name }
      });
    }

    const mention = email ? '<at>' + name + '</at>' : '👤 ' + name;
    rows.push({
      type: 'TextBlock',
      text: mention + '　' + task.name + '　期日: ' + task.end,
      wrap: true,
      spacing: 'Small'
    });
  });
  return rows;
}

// ── Adaptive Card 組み立て ──
const cardBody = [
  {
    type: 'TextBlock',
    text: '📅 タスク期限リマインダー — ' + now.toLocaleDateString('ja-JP'),
    weight: 'Bolder',
    size: 'Medium',
    color: 'Accent'
  }
]
  .concat(buildRows(tasksToday, '🔴', '本日が期限'))
  .concat(buildRows(tasks1,     '🚨', '明日が期限（あと' + remindDaysB + '日）'))
  .concat(buildRows(tasks3,     '⚠️',  '期限まで' + remindDaysA + '日'));

const repo  = process.env.GITHUB_REPOSITORY || '';
const pages = repo
  ? 'https://' + repo.split('/')[0] + '.github.io/' + repo.split('/')[1]
  : '';

const card = {
  type: 'AdaptiveCard',
  version: '1.4',
  msteams: { entities: mentionEntities },
  body: cardBody,
  actions: pages
    ? [{ type: 'Action.OpenUrl', title: 'ガントチャートを確認', url: pages }]
    : []
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
    console.log('Reminder sent successfully.');
  });
});
req.on('error', e => { console.error('Request error:', e.message); process.exit(1); });
req.write(payload);
req.end();
