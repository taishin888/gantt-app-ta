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
const viewerUrl = base ? base + '/viewer.html' : '';

// ── Webhook URL 確認 ──
const webhook = process.env.TEAMS_WEBHOOK;
if (!webhook) {
  console.error('[notify] ERROR: TEAMS_WEBHOOK is not set in GitHub Secrets.');
  console.error('[notify] Go to: Settings -> Secrets -> Actions -> New repository secret');
  console.error('[notify] Name: TEAMS_WEBHOOK, Value: your Teams Incoming Webhook URL');
  process.exit(1);   // エラー終了でActionsログに赤く表示させる
}
console.log('[notify] Webhook URL length:', webhook.length);
console.log('[notify] Viewer URL:', viewerUrl);

// ── 集計 ──
const total = data.tasks.length;
const doing = data.tasks.filter(t => t.status === 'doing').length;
const done  = data.tasks.filter(t => t.status === 'done').length;
const todo  = data.tasks.filter(t => t.status === 'todo').length;

// ── 担当者マップ ──
const memberMap = {};
(data.members || []).forEach(m => { memberMap[m.name] = m; });

// ── 担当タスク行（メンション形式） ──
// Incoming Webhook では <at>NAME</at> + msteams.entities でメンション
const mentionEntities = [];
const taskLines = [];

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
      taskLines.push('<at>' + name + '</at>　' + task.name + '　期日: ' + task.end);
    } else {
      taskLines.push('👤 ' + name + '　' + task.name + '　期日: ' + task.end);
    }
  });

// ── Adaptive Card（Incoming Webhook Power Automate経由用） ──
const adaptiveCard = {
  type: 'AdaptiveCard',
  version: '1.4',
  msteams: { entities: mentionEntities },
  body: [
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
    },
    ...taskLines.map(line => ({
      type: 'TextBlock',
      text: line,
      wrap: true,
      spacing: 'Small'
    }))
  ],
  actions: viewerUrl ? [{
    type: 'Action.OpenUrl',
    title: '📋 ガントチャートを見る（閲覧専用）',
    url: viewerUrl
  }] : []
};

// ── ペイロード：Incoming Webhook は attachments 形式 ──
const payload = JSON.stringify({
  type: 'message',
  attachments: [{
    contentType: 'application/vnd.microsoft.card.adaptive',
    contentUrl: null,
    content: adaptiveCard
  }]
});

console.log('[notify] Payload size:', Buffer.byteLength(payload), 'bytes');

// ── HTTPS送信 ──
function sendRequest(url, body, retryCount) {
  retryCount = retryCount || 0;
  const u = new URL(url);
  const req = https.request({
    hostname: u.hostname,
    path:     u.pathname + u.search,
    method:   'POST',
    headers: {
      'Content-Type':   'application/json',
      'Content-Length': Buffer.byteLength(body)
    }
  }, res => {
    let raw = '';
    res.on('data', d => raw += d);
    res.on('end', () => {
      console.log('[notify] Teams HTTP status:', res.statusCode);
      console.log('[notify] Teams response:', raw.slice(0, 200));
      if (res.statusCode === 200) {
        console.log('[notify] Notification sent successfully.');
      } else if (res.statusCode === 429 && retryCount < 2) {
        // Rate limit → 5秒後リトライ
        console.warn('[notify] Rate limited. Retrying in 5s...');
        setTimeout(() => sendRequest(url, body, retryCount + 1), 5000);
      } else {
        console.error('[notify] Failed. Status:', res.statusCode, 'Body:', raw);
        process.exit(1);
      }
    });
  });
  req.on('error', e => {
    console.error('[notify] Request error:', e.message);
    process.exit(1);
  });
  req.write(body);
  req.end();
}

sendRequest(webhook, payload);
