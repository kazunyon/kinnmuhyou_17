# 🤖 AIエージェント / 開発者向けガイドライン (AGENTS.md)

このドキュメントは、「勤務表Webアプリケーション」の開発・保守を行うAIエージェントおよび開発者のための行動指針とルールを定めたものです。

## 1. プロジェクト概要
**プロジェクト名**: 勤務表Webアプリケーション (Work Attendance Management System)
**目的**: 中小規模チーム向けの勤怠管理、日報作成、月次報告書の自動生成、および承認フローのデジタル化。

## 2. 技術スタックと環境

開発にあたっては以下の技術・バージョンを厳守してください。

| 領域 | 技術・ツール | 詳細 |
| --- | --- | --- |
| **Backend** | Python 3.8+ | **Framework**: Flask<br>**DB**: SQLite3 (標準ライブラリ)<br>**ORM**: 使用せずSQL直書き (schema.sql参照) |
| **Frontend** | Node.js 18+ | **Framework**: React<br>**Build Tool**: Vite<br>**Styling**: Tailwind CSS (tailwind.config.js)<br>**Http Client**: 標準 fetch API |
| **OS/Env** | Docker / Local | 文字コード: UTF-8 (BOMなし), 改行コード: LF |

## 3. 開発ルール (Code of Conduct)

### 3.1 言語設定
* **公用語**: **日本語** (Japanese)
* コード内のコメント、変数名の意図説明、プルリクエスト、Issueのやり取りは全て日本語で行ってください。
* ユーザーに見えるUIの文言も全て自然なビジネス日本語としてください。

### 3.2 コミットメッセージ規約
変更内容を明確にするため、以下のプレフィックスを必ず付与してください。

| プレフィックス | 意味 | 例 |
| --- | --- | --- |
| `feat:` | 新機能の追加 | `feat: 承認ステータスに「差戻し」を追加` |
| `fix:` | バグ修正 | `fix: 深夜残業時間の計算ロジックを修正` |
| `docs:` | ドキュメント変更 | `docs: READMEのセットアップ手順を更新` |
| `style:` | フォーマット修正 | `style: インデントのずれを修正（動作影響なし）` |
| `refactor:` | リファクタリング | `refactor: 日付計算処理を utils に共通化` |
| `test:` | テスト関連 | `test: 計算ロジックの単体テストを追加` |

### 3.3 コーディング規約
* **Backend (Python)**:
    * 型ヒント（Type Hints）を積極的に活用すること。
    * 複雑な計算ロジック（`attendance_calculator.py`など）には必ずDocstringを記述すること。
* **Frontend (React)**:
    * コンポーネントは機能ごとに `src/components` に分割すること。
    * ハードコードを避け、定数や設定ファイルを利用すること。

## 4. プロジェクト構成と重要ファイル

開発時に頻繁に参照・修正するファイルです。

### 📂 back_end/
* `app.py`: APIのエントリーポイント。ルーティング定義。
* `attendance_calculator.py`: **[重要]** 勤務時間、残業、深夜時間の計算ロジック中枢。
* `schema.sql`: データベース構造定義。テーブル変更時はここを修正し `init_db.py` を実行（※データ消失注意）。
* `init_db.py`: DB初期化スクリプト。

### 📂 front_end/src/
* `components/`: UIパーツ。
    * `DailyReportModal.jsx`: 日報入力・編集モーダル。
    * `ReportTable.jsx`: 月間の勤務表表示。
    * `PrintLayout.jsx`: 印刷用レイアウト定義。
* `utils/`: 共通ロジック。
    * `timeUtils.js`: 時間計算等のヘルパー関数。

## 5. 開発ワークフロー

### サーバー起動
開発時はバックエンドとフロントエンドを同時に起動してください。
1.  **Backend**: `python back_end/app.py` (Port: 5000)
2.  **Frontend**: `cd front_end && npm run dev` (Port: 5173)

### データベース変更フロー
1.  `back_end/schema.sql` を修正。
2.  `python back_end/init_db.py` を実行してDB再構築（**既存データは消えます**）。
3.  必要に応じてアプリケーションコードを修正。

## 6. 特に注意すべき要件
* **計算の正確性**: 勤務時間の計算（特に休憩時間や深夜時間のまたがり）は最優先事項です。変更時は既存のテストを実行してデグレがないか確認してください。
* **印刷レイアウト**: 帳票出力機能はA4サイズでの印刷を前提としています。`print-fix.css` や `@media print` のスタイル変更は慎重に行ってください。
* **レスポンシブ**: 基本はPCデスクトップ利用を想定していますが、タブレット等でも崩れないように配慮してください。