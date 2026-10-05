# 覚善：3点の隔離修正と検証結果

状態：隔離実装・自己検証済み。独立レビューと実ブラウザQAは未完了（QA_INCOMPLETE）。本番未反映。

## 対象と保存先
- 原本localcheckout: /Users/kazuki/Documents/Codex/2026-09-22/four-site-bugfixes/employee-ledger
- 隔離コピー: /tmp/kakuzen-security-fixes-20261001
- base: f0cae1c6c1966bc8ce0830aff1f00e132162c833。local clone --no-hardlinks、detached checkout。原本cleanを前後確認し、編集なし。
- candidateは未commit。candidate-manifest.jsonの変更ファイルSHA-256とcandidateDigestで識別。push/merge/branch作成なし。
- 対象は覚善のみ。誠・共有正本・比較作業は変更していない。

## 1. DB・添付の一式復元確認
scripts/security/isolated-restore.mjs:6(makeBackup)、12(verifyBackup)、41(restoreToEmptyEmulator)。Firestoreのwire field表現を保存し、timestamp/整数をJSONに丸めず維持。文書ごと・旧RTDB blobごとのchecksumと全payload hashを確認し、新添付全chunkと旧添付参照の存在/sha256を照合する。検査完了前に書込みしない。
復元先は固定127.0.0.1:8180/9100とdemo-kakuzen-restore-*だけ。live project、host/env fallback、credential指定、redirectを受け付けない。空のFirestoreとRTDBを検証し、上書き・resumeを拒否する。
合成fixture（tests/restore-rehearsal.test.mjs:20–37）で20業務table、2chunk、採番、監査event/marker計25文書と旧RTDB blob1件、新旧添付参照2件を復元。両DBを再読取りし全payload hash一致、参照hashを再検査した。manifest改変・chunk欠損/改変・旧blob欠損・live project・非空destinationは拒否した。
PDF根拠：第24章 p.489（DBとuploadを整合させ別環境で復元する）。
実装確度：合成環境で高。制限：本番backupを取得していないため、本番のbackup設定・実データ・外部HTTPS添付の完全復元は未確認。これは既存一式snapshotの検査/復元演習utilityであり、本番export収集運用の完成を意味しない。2サービス復元は原子的ではない。途中失敗時は元の検証済みbackupを保全し、新しい空demo destinationでやり直す。保持期限/RPO/RTO/責任者は今回決定していない。

## 2. 古い同時編集の上書き拒否
firebase-adapter.js:127(expectRevision)、168(selectRows)、190(updateRows)、200(deleteRows)、475–483(read snapshot)、537–563(updateRowByRevision)、581–593(deleteRowByRevision)で共通20tableにCASを拡張。legacy revision欠落は0、成功時+1。transaction再試行でも編集開始のexpectedRevisionを固定する。部分id/name検索では既存編集snapshotを更新せず、明示full reloadでretry可能。削除済みidへの保存もSTALE_WRITEにする。
dispatch.js:120/135で取引先modal開始revisionを固定、142で一覧revisionを使った削除。billing-settings.js:33/50/58で同じ対応。dispatch.js:174/287で現場親行の開始revisionを同一atomicWriteに渡し、子勤務パターンの置換も親競合時はcommitしない。
検証：2adapterで同じlegacy取引先/請求を読む→片方保存→他方の古い編集/削除を拒否。再読込後もexplicit modal revisionは元の値。画面handlerのVM検証でrevision7を固定、ST相当の元objectを99へ変更しても7で保存、失敗時modal/inputを維持。settingsの部分id検索で旧snapshotが更新されないこと、対象削除後の保存拒否も確認。既存従業員/有給/契約の同時編集・添付winner-onlyテストも維持。
PDF根拠：第20章 p.412–413（transactionと楽観的競合制御）。
実装確度：sourceと合成unitで高。制限：実ブラウザ2端末操作は未実施。取引先/請求/現場以外は共通adapterの最終full readに基づくため、別full reloadを挟んで開いたままの古い編集を保存する個別画面は追加UI確認対象。atomicWriteの既存内部置換で明示revision/既存read snapshotがない操作はtransaction内の現行値から更新する。全面的な全画面保証ではない。

## 3. 保存時の必要最小限検査と変更監査
firebase-adapter.js:486–509でID不変、無効対象、非有限数、循環入力、不正形式/危険key、変更する請求amount安全整数/is_billed booleanを検査。旧値の型が違っていても未変更なら維持する。未知の業務field、本文、金額符号、丸め・契約規則は追加しない。
firestore.rules:4–16/26–33で既存ledger_admin claimを維持し、20table allowlist・document ID・安全なrevision+1・変更された請求型をDBで強制する。新たな利用者roleやclaim・課金設定変更なし。
adapter:512–522のauditでactorUid、serverTimestamp、created/updated/deletedの対象document pathのみを記録。insert/employee CSV/atomicWrite/CAS update/deleteの行・添付と同じcommitに_audit_events eventと_meta/last-writeを保存する。本文・前後値・氏名・email・secretは記録しない。Rules:18–24で新規同commit event、actor/time/対象/行auditIdを確認し、監査なし業務writeを拒否。Rules:35–43で既存eventの更新/削除を禁止。450件単位で監査2文書を共有してaccess-call予算を維持する。
添付chunkはcreateの型/サイズと既存内容不変をRules:55–60で確認。UTF-8の4byte文字に対応する上限786432byteを実証し、古いUnicode添付方式と互換にした。
検証：直接RESTで無認証/非管理者・ID差替・revision再使用・請求不正型・監査なし保存・既存監査更新/削除・未知tableを拒否。正当な負額、未知field、旧未変更のamount文字列を許可。450件を監査付きcommitできた。添付過大/改変を拒否し絵文字196608codepointを許可。synthetic commit failureでは行/添付/監査すべて不変。
PDF根拠：第10章 p.214–232（server側入力検証）、第11章 p.233–246（添付保存）、第25章 p.496–516（監査/ログと個人情報）。
実装確度：unitと実Rules emulatorで高。制限：失敗した試行の永続監査、変更前後本文、監査検索画面、保持期限は追加しない。監査event単独の追加や既存採番文書の操作は管理者に許可されるため、eventの存在だけで業務変更実行を断定しない。deleteの古い編集判定はadapter transactionで行い、Rulesは削除監査を強制する。Admin SDK/IAMなどRules外の強権限までは防がない。

## 回帰・検証の証拠
- 指定された既存49テストはすべて成功。追加CAS/validation/editorを含むfocused 55成功。tests/firebase-adapter.test.mjsのmockは監査actor/timestampを実装し、擬似transactionのcommit途中awaitによる非原子的なraceを直した。assertionは競合messageが「実際に未表示の最新内容を表示済み」と言わない文に更新。
- KAKUZEN_RULES_EMULATOR=1 KAKUZEN_RESTORE_EMULATOR=1 node --test tests/*.test.mjs：全118成功、失敗/skip0。ログ all-tests.txt。unit、既存のその他test、実Rules 2test、両DB復元3testを含む。
- 変更JS3ファイルのnode --checkとgit diff --check成功。Architecture First FULLは既存bundle・整合性検証済みMermaid11.17.2 cacheを使いローカル生成、PDF4頁すべてPrimary実画像確認、artifact hash QA一致。
- npm run validate:repositoryは対象appにpackage.jsonがないためENOENT。成功扱いにしない。共有new-solvenは変更していないため、そのvalidatorをappの証拠に流用していない。
- emulatorはdemo projectとloopbackだけ。本番login/write/Rules/deploy、実顧客data、push/merge、外部sendなし。

## 互換性と本番反映案（未実施）
追加fieldは_revision/_auditId、新collectionは_audit_events、新管理文書は_meta/last-write。既存table/schema本文・採番・契約採番・添付prefixは維持。監査追加は1commitにつき2文書writeと保管量を増やす。料金・planの変更は行っていない。
親が独立source reviewと実ブラウザQAを完了→exact candidateを承認対象に固定→現行本番source/Rulesと互換性を確認→一式backupと回復手順を準備→別途push/公開承認のもと新clientを配布→開いた旧タブも新版へreloadしたことを確認→別途Rules反映承認を得て同版Rulesを反映→認証provider readbackと正常/拒否の確認、Issue87更新。旧clientは新Rulesで保存拒否されるため、無言の強制切替は禁止。
rollbackは新Rulesと旧clientを混在させない。旧Rulesに戻すと監査/検査強制が失われるため、単なる安全なrollbackと扱わず、親が候補別に判断する。

## 親への残り
solven-final-qa/SKILL.mdの「必要なLuna Maxを統括Primaryから直接起動」と本repoの孫禁止に従い、このWriterから独立QA/reviewerは起動していない。親から直接、候補manifestを固定して独立QAとImportant相当の独立reviewを依頼する必要がある。実ブラウザの編集/競合/再読込/取消、画面横断full reload、旧client切替とSDK実接続の確認を優先する。公開は今回の依頼外。
