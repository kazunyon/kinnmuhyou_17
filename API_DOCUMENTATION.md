# APIドキュメント

このドキュメントは、勤務表WebアプリケーションのバックエンドAPIの仕様を定義します。

## ベースURL

`/api`

---

## 1. マスターデータ関連

### 1.1. 在籍中の全社員リストを取得

- **エンドポイント**: `GET /employees`
- **説明**: 作業報告書の氏名選択プルダウンなどで使用する、在籍中（退職フラグが0）の社員リストを取得します。セキュリティのため、パスワード情報は含まれません。
- **成功レスポンス**:
  - **コード**: `200 OK`
  - **内容**:
    ```json
    [
      {
        "employee_id": 1,
        "company_id": 101,
        "employee_name": "山田 太郎",
        "department_name": "開発部",
        "employee_type": "正社員",
        "retirement_flag": 0
      },
      ...
    ]
    ```
- **エラーレスポンス**:
  - **コード**: `500 Internal Server Error`
  - **内容**: `{"error": "サーバー内部エラー"}`

### 1.2. 全社員リストを取得（マスターメンテナンス用）

- **エンドポイント**: `GET /employees/all`
- **説明**: マスターメンテナンス画面で使用する、全社員（退職者も含む）のリストを取得します。
- **成功レスポンス**:
  - **コード**: `200 OK`
  - **内容**: (1.1と同様の社員オブジェクトの配列)
- **エラーレスポンス**:
  - **コード**: `500 Internal Server Error`
  - **内容**: `{"error": "サーバー内部エラー"}`

### 1.3. 会社マスターを取得

- **エンドポイント**: `GET /companies`
- **説明**: 全ての会社情報を取得します。
- **成功レスポンス**:
  - **コード**: `200 OK`
  - **内容**:
    ```json
    [
      {
        "company_id": 101,
        "company_name": "株式会社ABC"
      },
      ...
    ]
    ```

### 1.4. 指定年の祝日リストを取得

- **エンドポイント**: `GET /holidays/<year>`
- **説明**: 指定された年の祝日リストを、「日付: 祝日名」の形式で取得します。
- **URLパラメータ**:
  - `year` (integer): 祝日を取得したい西暦年。
- **成功レスポンス**:
  - **コード**: `200 OK`
  - **内容**:
    ```json
    {
      "2025-01-01": "元日",
      "2025-10-13": "スポーツの日",
      ...
    }
    ```

### 1.5. オーナー情報を取得

- **エンドポイント**: `GET /owner_info`
- **説明**: システムのオーナーとして設定されている社員のIDと氏名を取得します。
- **成功レスポンス**:
  - **コード**: `200 OK`
  - **内容**:
    ```json
    {
      "owner_id": 1,
      "owner_name": "管理 太郎"
    }
    ```
- **エラーレスポンス**:
  - `404 Not Found`: `{"error": "オーナー情報が見つかりません"}`
  - `500 Internal Server Error`: `{"error": "サーバー内部エラー"}`

---

## 2. 取引先・案件マスター関連

### 2.1. 取引先リストを取得

- **エンドポイント**: `GET /clients`
- **説明**: 取引先のリストを取得します。`include_deleted=true` をクエリパラメータとして渡すと、論理削除済みの取引先も含まれます。
- **成功レスポンス**:
  - **コード**: `200 OK`
  - **内容**: `[{"client_id": 1, "client_name": "株式会社A", "deleted": 0}, ...]`

### 2.2. 取引先を追加

- **エンドポイント**: `POST /clients`
- **説明**: 新しい取引先を追加します。
- **リクエストボディ**: `{"client_name": "新しい取引先"}`
- **成功レスポンス**:
  - **コード**: `201 Created`
  - **内容**: `{"message": "追加しました", "client_id": 123}`

### 2.3. 取引先を更新

- **エンドポイント**: `PUT /clients/<client_id>`
- **説明**: 既存の取引先の情報を更新します。
- **リクエストボディ**: `{"client_name": "更新後の名前", "deleted_flag": 0}`
- **成功レスポンス**:
  - **コード**: `200 OK`
  - **内容**: `{"message": "更新しました"}`

### 2.4. 取引先を削除（論理削除）

- **エンドポイント**: `DELETE /clients/<client_id>`
- **説明**: 取引先を論理的に削除します。
- **成功レスポンス**:
  - **コード**: `200 OK`
  - **内容**: `{"message": "削除しました"}`

### 2.5. 案件リストを取得

- **エンドポイント**: `GET /projects`
- **説明**: 案件のリストを取得します。`include_deleted=true` をクエリパラメータとして渡すと、論理削除済みの案件も含まれます。
- **成功レスポンス**:
  - **コード**: `200 OK`
  - **内容**: `[{"project_id": 1, "project_name": "プロジェクトX", "client_id": 1, "client_name": "株式会社A", "deleted": 0}, ...]`

### 2.6. 案件を追加

- **エンドポイント**: `POST /projects`
- **説明**: 新しい案件を追加します。
- **リクエストボディ**: `{"client_id": 1, "project_name": "新しい案件"}`
- **成功レスポンス**:
  - **コード**: `201 Created`
  - **内容**: `{"message": "追加しました", "project_id": 456}`

### 2.7. 案件を更新

- **エンドポイント**: `PUT /projects/<project_id>`
- **説明**: 既存の案件の情報を更新します。
- **リクエストボディ**: `{"client_id": 1, "project_name": "更新後の案件名", "deleted_flag": 0}`
- **成功レスポンス**:
  - **コード**: `200 OK`
  - **内容**: `{"message": "更新しました"}`

### 2.8. 案件を削除（論理削除）

- **エンドポイント**: `DELETE /projects/<project_id>`
- **説明**: 案件を論理的に削除します。
- **成功レスポンス**:
  - **コード**: `200 OK`
  - **内容**: `{"message": "削除しました"}`

---

## 3. 作業報告書関連

### 3.1. 指定年月の作業記録と月次集計を取得

- **エンドポイント**: `GET /work_records/<employee_id>/<year>/<month>`
- **説明**: 指定した社員の特定年月の作業記録、特記事項、承認日、および月次集計サマリーを取得します。
- **URLパラメータ**:
  - `employee_id` (integer)
  - `year` (integer)
  - `month` (integer)
- **成功レスポンス**:
  - **コード**: `200 OK`
  - **内容**:
    ```json
    {
      "records": [
        {
          "day": 1,
          "start_time": "09:00",
          "end_time": "18:00",
          "break_time": "01:00",
          "work_content": "要件定義"
        },
        ...
      ],
      "special_notes": "月次報告です。",
      "approval_date": "2025-11-04",
      "monthly_summary": {
        "total_actual_work_hours": "160:00",
        "absent_days": 1,
        "paid_holidays": 2
      }
    }
    ```

### 2.2. 作業記録を保存

- **エンドポイント**: `POST /work_records`
- **説明**: 作業報告書の日次記録と特記事項を一括で保存（更新または新規作成）します。この操作は、操作対象の`employee_id`がオーナーIDと一致する場合にのみ許可されます。
- **リクエストボディ**:
  ```json
  {
    "employee_id": 1,
    "year": 2025,
    "month": 10,
    "records": [
      { "day": 1, "start_time": "09:00", ... },
      ...
    ],
    "special_notes": "更新された特記事項。"
  }
  ```
- **成功レスポンス**:
  - **コード**: `200 OK`
  - **内容**: `{"message": "保存しました"}`
- **エラーレスポンス**:
  - `400 Bad Request`: `{"error": "無効なデータです"}`
  - `403 Forbidden`: `{"error": "作業記録を更新する権限がありません。"}`
  - `500 Internal Server Error`: `{"error": "データベースエラー"}`

---

## 3. 勤怠管理表関連

### 3.1. 指定年月の勤怠記録を取得

- **エンドポイント**: `GET /attendance_records/<employee_id>/<year>/<month>`
- **説明**: 指定した社員の特定年月の勤怠記録（日次）と、サーバーサイドで計算された月次集計を取得します。勤怠管理表の表示に使用されます。
- **URLパラメータ**:
  - `employee_id` (integer)
  - `year` (integer)
  - `month` (integer)
- **成功レスポンス**:
  - **コード**: `200 OK`
  - **内容**:
    ```json
    {
      "daily_records": [
        {
          "day": 1,
          "date": "2025-10-01",
          "weekday": 2,
          "attendance_type": 1,
          "start_time": "09:00",
          "end_time": "18:00",
          "break_time": "01:00",
          "remarks": "要件定義",
          "daily_summary": {
            "actual_work_hours": "08:00",
            "overtime_hours": "00:00"
          }
        },
        ...
      ],
      "monthly_summary": {
        "total_work_days": 22,
        "total_actual_work_hours": "176:00"
      }
    }
    ```

### 3.2. 勤怠記録を保存

- **エンドポイント**: `POST /attendance_records`
- **説明**: 勤怠管理表から入力された日次勤怠データを一括で保存（更新または新規作成）します。
- **リクエストボディ**:
  ```json
  {
    "employee_id": 1,
    "records": [
      {
        "date": "2025-10-01",
        "attendance_type": 1,
        "start_time": "09:00",
        ...
      },
      ...
    ]
  }
  ```
- **成功レスポンス**:
  - **コード**: `200 OK`
  - **内容**: `{"message": "保存しました"}`

---

## 5. 日報関連

### 5.1. 指定日の日報データを取得

- **エンドポイント**: `GET /daily_report/<employee_id>/<date_str>`
- **説明**: 指定した社員の特定の日付の日報データを取得します。
- **URLパラメータ**:
  - `employee_id` (integer)
  - `date_str` (string, `YYYY-MM-DD`形式)
- **成功レスポンス**:
  - **コード**: `200 OK`
  - **内容**: (データが存在する場合)
    ```json
    {
      "report_id": 1,
      "employee_id": 1,
      "date": "2025-10-01",
      "work_summary": "詳細な作業内容",
      ...
    }
    ```
  - **内容**: (データが存在しない場合) `null`

### 4.2. 日報データを保存

- **エンドポイント**: `POST /daily_report`
- **説明**: 日報データを保存（更新または新規作成）します。関連する`work_records`テーブルの作業内容も同時に更新されます。
- **リクエストボディ**:
  ```json
  {
    "employee_id": 1,
    "date": "2025-10-01",
    "work_summary": "更新された作業内容",
    ...
  }
  ```
- **成功レスポンス**:
  - **コード**: `200 OK`
  - **内容**: `{"message": "日報を保存しました"}`

---

## 6. レポート承認関連

### 6.1. 月次レポートを承認

- **エンドポイント**: `POST /monthly_reports/approve`
- **説明**: 月次レポートを承認し、承認日を記録します。
- **リクエストボディ**:
  ```json
  {
    "employee_id": 2,
    "year": 2025,
    "month": 10
  }
  ```
- **成功レスポンス**:
  - **コード**: `200 OK`
  - **内容**:
    ```json
    {
      "message": "承認しました",
      "approval_date": "2025-11-04"
    }
    ```
- **エラーレスポンス**:
  - `403 Forbidden`: `{"error": "レポートを承認する権限がありません。"}`

### 6.2. 月次レポートの承認を取り消し

- **エンドポイント**: `POST /monthly_reports/cancel_approval`
- **説明**: 月次レポートの承認を取り消し、承認日を`null`に設定します。
- **リクエストボディ**:
  ```json
  {
    "employee_id": 2,
    "year": 2025,
    "month": 10
  }
  ```
- **成功レスポンス**:
  - **コード**: `200 OK`
  - **内容**:
    ```json
    {
      "message": "承認を取り消しました",
      "approval_date": null
    }
    ```
- **エラーレスポンス**:
  - `403 Forbidden`: `{"error": "承認を取り消す権限がありません。"}`
  - `404 Not Found`: `{"error": "対象のレポートが見つかりません"}`

---

## 7. 社員マスターメンテナンス

### 7.1. マスターメンテナンスの認証

- **エンドポイント**: `POST /master/authenticate`
- **説明**: マスターメンテナンス機能を利用するためのユーザー認証を行います。
- **リクエストボディ**:
  ```json
  {
    "employee_id": 1,
    "password": "password123"
  }
  ```
- **成功レスポンス**:
  - **コード**: `200 OK`
  - **内容**:
    ```json
    {
      "success": true,
      "message": "認証に成功しました",
      "is_owner": true
    }
    ```
- **エラーレスポンス**:
  - `401 Unauthorized`: `{"success": false, "message": "認証情報が正しくありません"}`

### 7.2. 新しい社員を追加

- **エンドポイント**: `POST /employee`
- **説明**: 新しい社員情報を追加します。認証済みのユーザーである必要があります。
- **リクエストボディ**:
  ```json
  {
    "auth_user_id": 1,
    "auth_password": "password123",
    "company_id": 101,
    "employee_name": "新規社員",
    "department_name": "営業部",
    "employee_type": "正社員",
    "retirement_flag": false
  }
  ```
- **成功レスポンス**:
  - **コード**: `201 Created`
  - **内容**: `{"message": "社員を追加しました", "employee_id": 124}`

### 7.3. 既存の社員情報を更新

- **エンドポイント**: `PUT /employee/<employee_id>`
- **説明**: 既存の社員情報を更新します。認証済みのユーザーである必要があります。
- **URLパラメータ**:
  - `employee_id` (integer): 更新対象の社員ID。
- **リクエストボディ**:
  ```json
  {
    "auth_user_id": 1,
    "auth_password": "password123",
    "employee_name": "更新後の氏名",
    "department_name": "開発部",
    "employee_type": "契約社員",
    "retirement_flag": false
  }
  ```
- **成功レスポンス**:
  - **コード**: `200 OK`
  - **内容**: `{"message": "社員情報を更新しました"}`
