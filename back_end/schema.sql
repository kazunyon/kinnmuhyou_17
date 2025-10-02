-- データベースのテーブル構造を定義します

-- 既存のテーブルがあれば削除
DROP TABLE IF EXISTS employees;
DROP TABLE IF EXISTS companies;
DROP TABLE IF EXISTS holidays;
DROP TABLE IF EXISTS work_records;
DROP TABLE IF EXISTS daily_reports;

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
    FOREIGN KEY (company_id) REFERENCES companies (company_id)
);

-- 祝日マスター
CREATE TABLE holidays (
    date TEXT PRIMARY KEY, -- 'YYYY-MM-DD'形式
    holiday_name TEXT NOT NULL
);

-- 日次勤務記録トラン
CREATE TABLE work_records (
    record_id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    date TEXT NOT NULL, -- 'YYYY-MM-DD'形式
    start_time TEXT, -- 'HH:MM'形式
    end_time TEXT, -- 'HH:MM'形式
    break_time TEXT, -- 'HH:MM'形式
    work_content TEXT,
    special_notes TEXT, -- 特記事項（その月の最初のレコードにのみ格納）
    UNIQUE(employee_id, date),
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
