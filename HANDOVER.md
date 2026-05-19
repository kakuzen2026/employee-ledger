# KAKUZEN 派遣・従業員管理システム 引き継ぎ資料

## 基本情報

| 項目 | 内容 |
|------|------|
| アプリ名 | 派遣・従業員管理システム |
| 用途 | 取引先・現場・派遣契約・請求・従業員台帳・有給・証明書・雇用契約書を一元管理する社内業務システム |
| 正式リポジトリ | `kakuzen2026/employee-ledger` |
| 正式公開URL | https://kakuzen2026.github.io/employee-ledger/ |
| 旧リポジトリ | `kakuzen2026/dispatch-kanri` は統合済み。公開入口は employee-ledger へリダイレクトする互換用として扱う |
| 実装形式 | ビルドなしの単一HTMLアプリ。`index.html` が本体 |

## 技術構成

| 項目 | 内容 |
|------|------|
| DB | Supabase `wkzbsdfgslidubqpifwa` |
| 認証 | Supabase Auth メール + パスワード |
| ホスティング | GitHub Pages |
| フロント | HTML / CSS / JavaScript / Supabase JS v2 |

```js
const SUPA_URL = 'https://wkzbsdfgslidubqpifwa.supabase.co';
const SUPA_KEY = 'sb_publishable_mfVmygJgUjnax83quON02Q_KMdYfF-Y';
```

旧従業員DB `jqokhqybxjkcantxsjfm` は廃止予定です。主要データは統合先DBに移行済みで、削除はバックアップ・公開動作確認・一定期間の保管後に判断します。

## 主要テーブル

| テーブル名 | 役割 |
|-----------|------|
| `clients` | 取引先 |
| `sites` | 現場 |
| `contracts` | 派遣契約 |
| `contract_employees` | 契約と従業員の紐づけ |
| `billing` | 請求 |
| `employee_records` | 就業・記録 |
| `work_patterns` | 派遣管理側の勤務パターン |
| `employees` | 従業員台帳 |
| `departments` | 部署マスター |
| `visa_types` | 在留資格マスター |
| `emp_work_patterns` | 従業員管理側の勤務パターン |
| `company_info` | 自社情報 |
| `yukyu_records` | 有給取得記録 |
| `yukyu_grants` | 有給付与記録 |
| `certificates` | 証明書発行履歴 |
| `employment_contracts` | 雇用契約書履歴 |
| `dispatch_contracts` | 派遣契約同期・従業員側表示用 |
| `settings` / `assignments` / `doc_templates` | 設定・補助テーブル |

## 現在の統合状態

- `index.html` に派遣管理と従業員管理を統合済み。
- `従業員管理.html`、`jugyoin.html`、`従業員.html`、`従業員すまほ.html`、`従業員差し替え.html` は旧URL互換入口で、`index.html` へリダイレクトします。
- `dispatch-kanri` リポジトリの本体HTMLは archive 済みで、現在の入口は `employee-ledger` へ転送します。
- アプリ接続先は統合先Supabase `wkzbsdfgslidubqpifwa` に一本化します。

## 検証メモ

2026-05-19 時点の確認:

| 対象 | 結果 |
|------|------|
| 統合先DB `wkzbsdfgslidubqpifwa` | ACTIVE_HEALTHY |
| 旧DB `jqokhqybxjkcantxsjfm` | ACTIVE_HEALTHY、廃止予定 |
| 統合先Authユーザー | 1件 |
| 統合先RLS | public主要20テーブルで有効 |
| 旧DB主要データ | 統合先にID欠落なし |
| `index.html` | インラインJS構文チェック済み |

主要件数:

| テーブル | 統合先 | 旧DB | 判断 |
|---------|--------|------|------|
| `employees` | 60 | 60 | 旧DB分は統合先に存在 |
| `departments` | 14 | 14 | 旧DB分は統合先に存在 |
| `visa_types` | 10 | 10 | 旧DB分は統合先に存在 |
| `yukyu_records` | 56 | 27 | 統合先のほうが新しい |
| `yukyu_grants` | 61 | 61 | 旧DB分は統合先に存在 |
| `certificates` | 2 | 1 | 統合先のほうが新しい |
| `dispatch_contracts` | 1 | 1 | 旧DB分は統合先に存在 |

## 残作業

1. `employee-ledger` の変更を公開反映する。
2. 公開URLでログイン、派遣管理、従業員管理、派遣契約詳細、CRUDを確認する。
3. 問題がなければ `dispatch-kanri` を archive する。
4. 旧Supabase `jqokhqybxjkcantxsjfm` はすぐ削除せず、バックアップと一定期間の保管後に停止・削除を判断する。

## 運用ルール

- 本番DB変更、GitHub Pages公開、旧リポジトリarchive、旧Supabase停止・削除は事前承認が必要。
- 削除より先にバックアップを取得する。
- 旧URL互換ファイルは、外部ブックマーク対策として当面残す。
