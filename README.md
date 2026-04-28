# gantt-app-ta
#　セットアップ・使い方ガイド

---

## 目次

1. [全体の仕組み](#1-全体の仕組み)
2. [GitHubリポジトリの作成](#2-githubリポジトリの作成)
3. [ファイルの配置](#3-ファイルの配置)
4. [GitHub Pages の有効化](#4-github-pages-の有効化)
5. [Teams Webhook の取得と設定](#5-teams-webhook-の取得と設定)
6. [Personal Access Token の作成](#6-personal-access-token-の作成)
7. [アプリの初期設定](#7-アプリの初期設定)
8. [毎日の使い方](#8-毎日の使い方)
9. [GitHub Actions の確認方法](#9-github-actions-の確認方法)
10. [トラブルシューティング](#10-トラブルシューティング)

---

## 1. 全体の仕組み

```
あなたのブラウザ
     │
     │  ガントチャートを編集（ドラッグ・入力）
     │
     ▼
index.html（GitHub Pages）
     │
     │  「保存 & 通知」ボタンを押す
     │  → GitHub API 経由で data/tasks.json を更新
     │
     ▼
GitHub リポジトリ（data/tasks.json が更新される）
     │
     │  push を検知して GitHub Actions が自動起動
     │
     ├─▶ Teams チャンネルに「更新通知」を送信
     ├─▶ 閲覧専用 HTML（gantt-export.html）を生成
     └─▶ GitHub Pages に最新版をデプロイ

毎日 9:00 JST（GitHub Actions スケジュール）
     │
     └─▶ 期限3日前・1日前のタスクを Teams に通知
```

**ポイント：** サーバー不要。すべて GitHub の無料機能だけで動く。

---

## 2. GitHubリポジトリの作成

### 手順

1. https://github.com を開き、右上の「**＋**」→「**New repository**」をクリック

2. 以下のように設定します

   | 項目 | 設定値 |
   |------|--------|
   | Repository name | `gantt-app`（任意） |
   | Visibility | **Public**（GitHub Pages 無料利用のため） |
   | Initialize this repository | ✅ チェックを入れる |
   | Add a README file | ✅ チェックを入れる |

3. 「**Create repository**」をクリック

> **注意：** Private リポジトリでも GitHub Pages は使えますが、GitHub Pro（有料）が必要です。無料で使う場合は Public にしてください。

---

## 3. ファイルの配置

### 方法A：GitHub のウェブ画面からアップロード（簡単）

1. 作成したリポジトリのページを開く

2. `index.html` をアップロード
   - 「**Add file**」→「**Upload files**」をクリック
   - `index.html` をドラッグ＆ドロップ
   - 「**Commit changes**」をクリック

3. `data` フォルダと `tasks.json` を作成
   - 「**Add file**」→「**Create new file**」をクリック
   - ファイル名欄に `data/tasks.json` と入力（スラッシュを入れると自動でフォルダが作られます）
   - `tasks.json` の中身をコピー＆ペースト
   - 「**Commit new file**」をクリック

4. GitHub Actions ワークフローを配置
   - 「**Add file**」→「**Create new file**」
   - ファイル名: `.github/workflows/save-and-notify.yml`
   - `save-and-notify.yml` の内容をコピー＆ペースト → コミット
   - 同様に `.github/workflows/daily-reminder.yml` も作成

### 方法B：Git コマンドで一括アップロード（効率的）

```bash
# リポジトリをクローン
git clone https://github.com/あなたのユーザー名/gantt-app.git
cd gantt-app

# ファイルをすべてコピー
# （ダウンロードしたファイル一式をこのフォルダに置く）
cp /path/to/index.html .
cp /path/to/tasks.json data/
cp /path/to/save-and-notify.yml .github/workflows/
cp /path/to/daily-reminder.yml .github/workflows/

# コミット＆プッシュ
git add .
git commit -m "初期セットアップ"
git push origin main
```

### 最終的なファイル構成の確認

GitHub のリポジトリページで以下の構成になっていればOKです。

```
gantt-app/
├── .github/
│   └── workflows/
│       ├── save-and-notify.yml   ← 保存時の通知
│       └── daily-reminder.yml    ← 毎日のリマインダー
├── data/
│   └── tasks.json                ← タスクデータ
├── index.html                    ← アプリ本体
└── README.md
```

---

## 4. GitHub Pages の有効化

1. リポジトリの「**Settings**」タブをクリック

2. 左サイドバーの「**Pages**」をクリック

3. **Source** の設定
   - Branch: `gh-pages`（最初はないので `main` を選択）
   - フォルダ: `/ (root)`
   - 「**Save**」をクリック

   > 最初の保存・通知実行後、`gh-pages` ブランチが自動生成されます。その後、`gh-pages` に切り替えてください。

4. しばらく待つと、ページ上部に以下のようなURLが表示されます
   ```
   Your site is live at https://あなたのユーザー名.github.io/gantt-app/
   ```

5. このURLをブラウザで開くとアプリが使えます

---

## 5. Teams Webhook の取得と設定

### Teams側の操作

1. Teams で通知を受け取りたい**チャンネル**を開く

2. チャンネル名の右にある「**…**」（その他のオプション）をクリック

3. 「**コネクタ**」をクリック

4. 検索欄に「**Incoming Webhook**」と入力し、「**追加**」をクリック

5. 名前を入力（例：`ガントチャート通知`）し、必要に応じてアイコン画像をアップロード

6. 「**作成**」をクリック

7. 表示されたURL（`https://...webhook.office.com/webhookb2/...`）を**コピーして保存**

   > このURLは再表示できません。必ずメモしておいてください。

8. 「**完了**」をクリック

### GitHub Secrets への登録

1. GitHubリポジトリの「**Settings**」→「**Secrets and variables**」→「**Actions**」を開く

2. 「**New repository secret**」をクリック

3. 以下のように入力して「**Add secret**」

   | 項目 | 入力値 |
   |------|--------|
   | Name | `TEAMS_WEBHOOK` |
   | Secret | コピーしたWebhook URL |

---

## 6. Personal Access Token の作成

アプリがブラウザから直接 GitHub にデータを保存するために必要です。

### 作成手順

1. GitHub の右上アイコン →「**Settings**」をクリック

2. 左サイドバー最下部の「**Developer settings**」をクリック

3. 「**Personal access tokens**」→「**Tokens (classic)**」をクリック

4. 「**Generate new token**」→「**Generate new token (classic)**」をクリック

5. 以下のように設定します

   | 項目 | 設定 |
   |------|------|
   | Note（メモ） | `gantt-app` など任意 |
   | Expiration | `90 days` または `No expiration` |
   | Scopes | **`repo`** にチェック（これだけでOK） |

6. 「**Generate token**」をクリック

7. 表示されたトークン（`ghp_xxxx...`）を**必ずコピーして保存**

   > このページを離れると二度と表示されません。

---

## 7. アプリの初期設定

1. GitHub Pages のURL（`https://ユーザー名.github.io/gantt-app/`）をブラウザで開く

2. 上部タブの「**⚙️ 設定**」をクリック

3. 以下を入力します

   | 項目 | 入力内容 |
   |------|----------|
   | リポジトリ | `あなたのユーザー名/gantt-app` |
   | Personal Access Token | `ghp_xxxx...`（先ほど作成したもの） |
   | ブランチ | `main`（デフォルトのまま） |
   | Teams Webhook URL | （参考用・実際の送信はActions経由） |

4. 「**接続テスト**」をクリックして「接続成功」と表示されることを確認

5. 「**設定保存**」をクリック

   > 設定はブラウザのローカルストレージに保存されます。別のPCからアクセスする場合は再入力が必要です。

### メンバーの登録

1. 「**👥 メンバー管理**」タブを開く

2. 「＋ メンバー追加」ボタンで担当者を登録

   | 項目 | 説明 |
   |------|------|
   | 名前 | タスクの担当者名（ガントチャートに表示） |
   | メールアドレス | 連絡先 |
   | Teams ID | `@ユーザー名`形式（リマインダーのメンション用） |
   | 部署・役割 | 任意 |

---

## 8. 毎日の使い方

### タスクの編集（ガントチャート画面）

| 操作 | 方法 |
|------|------|
| タスクの移動 | バーをドラッグ（開始日・終了日が一緒に動く） |
| 終了日の変更 | バーの右端をドラッグ |
| 詳細編集 | バーをダブルクリック |
| 今日の位置へ移動 | 上部「今日」ボタン |
| 表示期間の変更 | 下部のセレクト（1ヶ月〜12ヶ月） |
| ズーム調整 | 下部のスライダー |

### タスクの追加・編集（タスク編集タブ）

1. 「**✏️ タスク編集**」タブを開く
2. 「＋ タスク追加」ボタンをクリック
3. 以下の項目を設定
   - グループ（フェーズ分け）
   - タスク名・担当者・色
   - 開始日・終了日
   - 依存タスク（「このタスクの何日後に開始」の設定）
   - 進捗（0〜100%）・ステータス

### 保存と通知

1. 上部の「**💾 保存 & 通知**」ボタンをクリック

2. 自動で以下が実行されます（約1〜2分）

   ```
   ① data/tasks.json が GitHub に保存される
   ② GitHub Actions が起動
   ③ Teams チャンネルに更新通知が届く
   ④ 閲覧専用HTMLが生成される
   ⑤ GitHub Pages に最新版がデプロイされる
   ```

---

## 9. GitHub Actions の確認方法

### 実行状況の確認

1. GitHubリポジトリの「**Actions**」タブをクリック

2. ワークフロー一覧が表示されます
   - ✅ 緑のチェック → 成功
   - ❌ 赤のバツ → 失敗（クリックでログ確認）
   - 🟡 黄色の丸 → 実行中

3. クリックするとログの詳細が見られます

### 手動でリマインダーを送信したい場合

1. 「Actions」タブ → 「**Daily Deadline Reminder**」をクリック

2. 右側の「**Run workflow**」→「**Run workflow**」をクリック

3. 即座にリマインダーチェックが実行されます

### ワークフローが失敗する主な原因

| エラー | 原因 | 対処 |
|--------|------|------|
| `TEAMS_WEBHOOK` not set | Secretが未設定 | Settings → Secrets で登録 |
| 403 Forbidden | Tokenの権限不足 | `repo` スコープで再作成 |
| gh-pages ブランチなし | 初回デプロイ未実施 | 手動で一度pushしてみる |

---

## 10. トラブルシューティング

### アプリが開けない（404エラー）

- GitHub Pages の有効化が完了していない可能性があります
- Settings → Pages でURLが表示されているか確認
- 最初のpushから反映まで数分かかることがあります

### 「接続テスト」が失敗する

- Personal Access Token の有効期限が切れていないか確認
- Token に `repo` スコープが付いているか確認
- リポジトリ名が `ユーザー名/リポジトリ名` の形式になっているか確認

### Teams に通知が来ない

- GitHub の Actions タブでワークフローが成功しているか確認
- `TEAMS_WEBHOOK` Secret が正しく設定されているか確認
- Webhook URL の有効期限（Teams側で無効化されていないか）を確認

### 保存できない（エラーメッセージが出る）

- ブラウザのコンソール（F12 → Console）でエラー内容を確認
- Token が `No expiration` ではなく期限切れになっていないか確認
- リポジトリが Public になっているか確認

### データが消えた・別端末で見えない

- データは GitHub の `data/tasks.json` に保存されています
- 別の端末でも設定タブで同じリポジトリ・Tokenを入力すれば、起動時に自動読み込みされます
- ブラウザのローカルストレージには**設定のみ**保存（データは GitHub が正）

---

## 補足：セキュリティについて

| 項目 | 説明 |
|------|------|
| Personal Access Token | ブラウザのローカルストレージに保存されます。共有PCでは使用後に削除を推奨 |
| タスクデータ | パブリックリポジトリの場合、`data/tasks.json` は誰でも閲覧可能です。機密情報の記載は避けてください |
| Teams Webhook | GitHub Secrets に保存され、ログにも表示されません |
| Token の権限 | `repo` スコープのみ。最小権限の原則に従っています |

---

*最終更新: 2025/04/28*
