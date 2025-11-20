-- データベースのテーブル構造を定義します

-- 既存のテーブルがあれば削除
DROP TABLE IF EXISTS employees;
DROP TABLE IF EXISTS companies;
DROP TABLE IF EXISTS holidays;
DROP TABLE IF EXISTS work_records;
DROP TABLE IF EXISTS daily_reports;
DROP TABLE IF EXISTS monthly_reports;
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS work_details;

-- 会社マスター
CREATE TABLE companies (
    company_id INTEGER PRIMARY KEY,
    company_name TEXT NOT NULL
);

-- 社員マスター
CREATE TABLE employees (
    employee_id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL,
    employee_name TEXT NOT NULL,
    department_name TEXT,
    employee_type TEXT, -- '正社員', 'アルバイト'など
    retirement_flag INTEGER NOT NULL DEFAULT 0, -- 0:在職, 1:退職
    password TEXT, -- マスターユーザーのパスワード
    FOREIGN KEY (company_id) REFERENCES companies (company_id)
);

-- 祝日マスター
CREATE TABLE holidays (
    date TEXT PRIMARY KEY, -- 'YYYY-MM-DD'形式
    holiday_name TEXT NOT NULL
);

-- 日次勤務記録トラン (ヘッダー)
CREATE TABLE work_records (
    record_id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    date TEXT NOT NULL, -- 'YYYY-MM-DD'形式
    holiday_type TEXT, -- 休日種別: '法定休', '所定休' など
    attendance_type TEXT, -- 勤怠種別: '有休', '欠勤' など
    start_time TEXT, -- 'HH:MM'形式
    end_time TEXT, -- 'HH:MM'形式
    break_time TEXT, -- 'HH:MM'形式 (5:00-22:00の休憩)
    night_break_time TEXT, -- 'HH:MM'形式 (22:00-5:00の休憩)
    work_content TEXT, -- 備考
    UNIQUE(employee_id, date),
    FOREIGN KEY (employee_id) REFERENCES employees (employee_id)
);

-- 月次レポート情報（特記事項など）
CREATE TABLE monthly_reports (
    report_id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    special_notes TEXT,
    approval_date TEXT, -- 承認日 (YYYY-MM-DD)
    absent_days INTEGER DEFAULT 0,
    paid_holidays INTEGER DEFAULT 0,
    compensatory_holidays INTEGER DEFAULT 0,
    substitute_holidays INTEGER DEFAULT 0,
    late_days INTEGER DEFAULT 0,
    early_leave_days INTEGER DEFAULT 0,
    holiday_work_days INTEGER DEFAULT 0,
    UNIQUE(employee_id, year, month),
    FOREIGN KEY (employee_id) REFERENCES employees (employee_id)
);

-- 日報トラン
CREATE TABLE daily_reports (
    report_id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    date TEXT NOT NULL, -- 'YYYY-MM-DD'形式
    work_summary TEXT, -- 作業内容
    problems TEXT, -- 問題点
    challenges TEXT, -- 課題
    tomorrow_tasks TEXT, -- 明日する内容
    thoughts TEXT, -- 所感
    UNIQUE(employee_id, date),
    FOREIGN KEY (employee_id) REFERENCES employees (employee_id)
);

-- 取引先マスター
CREATE TABLE customers (
    customer_id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT NOT NULL UNIQUE
);

-- 案件マスター
CREATE TABLE projects (
    project_id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_name TEXT NOT NULL,
    customer_id INTEGER NOT NULL,
    UNIQUE(project_name, customer_id),
    FOREIGN KEY (customer_id) REFERENCES customers (customer_id)
);

-- 作業明細トラン
CREATE TABLE work_details (
    work_detail_id INTEGER PRIMARY KEY AUTOINCREMENT,
    work_record_id INTEGER NOT NULL,
    project_id INTEGER NOT NULL,
    work_time REAL NOT NULL, -- 時間単位 (例: 1.5時間)
    work_description TEXT,
    FOREIGN KEY (work_record_id) REFERENCES work_records (record_id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects (project_id)
);
