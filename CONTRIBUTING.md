# Contributing to kinnmuhyou_17

このプロジェクトへの貢献に興味を持っていただきありがとうございます。
以下は、開発者およびAIエージェント（Jules, GitHub Copilot等）向けのガイドラインです。

---

## 🤖 AI Agent Guidelines (For Jules & Copilot)

**IMPORTANT: This project STRICTLY uses JAPANESE for all development activities.**

If you are an AI agent (such as Google Jules, GitHub Copilot Workspace, or similar), you **MUST** follow these rules without exception:

### 1. Communication Language
* **Response:** You MUST respond to all user queries and prompts in **Japanese** (日本語).
* **Thinking Process:** Even if your internal reasoning is in English, the final output presented to the user must be in **Japanese**.

### 2. Coding Standards
* **Commit Messages:** Must be written in **Japanese**.
    * ✅ `fix: ログイン画面のレイアウト崩れを修正`
    * ❌ `fix: fix layout issue on login screen`
* **Code Comments:** All comments inside the code must be in **Japanese**.
* **Variable Names:** Use English for variable/function names, but ensure they are descriptive.

### 3. Documentation & Pull Requests
* **Pull Request Titles & Descriptions:** Must be written in **Japanese**.
* **Issue Responses:** Must be written in **Japanese**.

### 4. Project Context
* This is a Japanese attendance management system (勤務表アプリ).
* Please consider Japanese business customs (e.g., specific holidays, era names like "Reiwa").

---

## 🛠 開発ガイドライン (For Humans)

### 開発言語
* このプロジェクトの公用語は **日本語** です。
* IssueやPRのやり取りは全て日本語で行ってください。

### コミットメッセージの規約
コミットメッセージは日本語で、以下のプレフィックスを推奨します。
* `feat:` 新機能の追加
* `fix:` バグ修正
* `docs:` ドキュメントのみの変更
* `style:` コードの動作に影響しない変更（空白、フォーマットなど）
* `refactor:` リファクタリング（機能追加やバグ修正を含まない変更）

### 環境設定
* **文字コード:** UTF-8 (BOMなし)
* **改行コード:** LF
