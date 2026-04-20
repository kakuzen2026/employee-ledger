# プロジェクト引き継ぎ資料 (HANDOVER)

---

## プロジェクト基本情報

| 項目 | 内容 |
|------|------|
| アプリ名 | 派遣・従業員管理システム |
| 用途・目的 | 派遣会社向けの取引先・現場・契約・請求・従業員台帳を一元管理するシステム |
| GitHubアカウント名 | kakuzen2026 |
| GitHubリポジトリ名 | employee-ledger |
| 公開URL | https://kakuzen2026.github.io/employee-ledger/ |

---

## 技術構成

| 項目 | 内容 |
|------|------|
| DB | Supabase (`wkzbsdfgslidubqpifwa.supabase.co`) |
| 認証方式 | Supabase Auth |
| ファイル保存先 | （未記入） |
| ホスティング | GitHub Pages（`main` ブランチの `index.html` を直接配信） |
| 実装形式 | **単一HTMLファイル**（`index.html` 1ファイルにHTML/CSS/JSをすべて記述） |
| CSSフォント | Noto Sans JP / DM Mono（Google Fonts CDN） |

### Supabase SDK 読み込み
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
```

### Supabase 設定値
```js
const SUPA_URL = 'https://wkzbsdfgslidubqpifwa.supabase.co';
const SUPA_KEY = 'sb_publishable_mfVmygJgUjnax83quON02Q_KMdYfF-Y';
const db = createClient(SUPA_URL, SUPA_KEY);
```

---

## データ構造

Supabase テーブル一覧：

| テーブル名 | 役割 |
|-----------|------|
| `clients` | 取引先情報（派遣先企業） |
| `sites` | 現場情報（就業場所・責任者など） |
| `contracts` | 契約情報（取引先・現場・契約期間・単価など） |
| `billing` | 請求情報（請求金額・月・ステータスなど） |
| `records` | 勤怠・就業記録 |
| `jugyoin` | 従業員台帳（氏名・在留資格・ビザ期限・所属など） |
| （未記入） | その他テーブルは index.html 内参照 |

---

## 主要機能

### 実装済み

- **認証** ― Supabase Auth によるログイン・ログアウト
- **ダッシュボード** ― KPI・集計サマリーの表示
- **取引先管理（CRUD）** ― 取引先（派遣先企業）の一覧・登録・編集
- **現場管理（CRUD）** ― 現場・就業場所の一覧・登録・編集
- **契約管理（CRUD）** ― 派遣契約の一覧・登録・編集
- **請求管理（CRUD）** ― 請求情報の一覧・登録
- **就業記録** ― 勤怠・配置の記録
- **従業員台帳（jugyoin）** ― 従業員の詳細情報・在留資格・ビザ期限アラート
- **レスポンシブ対応** ― モバイル用ボトムナビゲーション

### ファイル構成

| ファイル名 | 役割 |
|-----------|------|
| `index.html` | メインアプリ（派遣管理全機能） |
| `jugyoin.html` | 従業員台帳サブアプリ（旧バージョン） |
| `従業員.html` / `従業員管理.html` | プロトタイプ・試作版 |
| `従業員すまほ.html` / `従業員差し替え.html` | モバイル対応・差し替え試作版 |

---

## 現在の状態

| 項目 | 内容 |
|------|------|
| 完成度 | （未記入） |
| 状態 | **開発中**（メインアプリ動作中・試作ファイル複数残存） |

---

## 進行中の作業

（未記入）

---

## 次にやること（優先順）

1. **試作ファイルの整理** ― `jugyoin.html`・`従業員*.html` の扱いを決定（削除 or 統合）
2. **Supabase RLS 設定** ― 認証済みユーザーのみアクセス可能なルールを本番用に強化
3. （未記入）

---

## 未解決の課題・既知のバグ

| # | 内容 | 優先度 |
|---|------|--------|
| 1 | 旧バージョンHTMLファイルが複数残存しており整理が必要 | 中 |
| 2 | （未記入） | （未記入） |

---

## 注意事項・独自ルール

- **単一HTMLファイル構成**：メインアプリは `index.html` 1ファイルに集約。分割しないこと
- **Supabase使用**：Firebase ではなく Supabase（PostgreSQL）を使用
- **GitHub Pages で直接配信**：ビルドプロセスなし。`main` ブランチの `index.html` を直接 push すれば即反映
- **従業員台帳は index.html に統合済み**：`jugyoin` ページとして組み込まれている

---

## 直近で編集したファイルと箇所

| ファイル名 | 箇所 | 内容 |
|-----------|------|------|
| `index.html` | （未記入） | （未記入） |

---

## コミット履歴（直近）

| ハッシュ | 内容 |
|---------|------|
| ab9c523 | docs: add skill activation policy to CLAUDE.md |
| f8b4a31 | （未記入） |

---

*このファイルは Claude (Cowork mode) により自動生成されました。*
