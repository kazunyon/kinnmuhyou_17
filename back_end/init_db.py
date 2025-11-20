import sqlite3
import os
from werkzeug.security import generate_password_hash

# このスクリプトの場所を基準にデータベースファイルのパスを決定
db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'database.db')
schema_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'schema.sql')

def init_db():
    """データベースを初期化し、スキーマを適用して初期データを挿入します。"""
    try:
        if os.path.exists(db_path):
            os.remove(db_path)
            print("既存のデータベースファイルを削除しました。")

        connection = sqlite3.connect(db_path)
        print("データベースに接続しました。")

        with open(schema_path, 'r', encoding='utf-8') as f:
            connection.executescript(f.read())
        print("データベーススキーマを適用しました。")

        cursor = connection.cursor()

        # --- 初期データの挿入 ---

        # 会社マスター
        cursor.execute("INSERT INTO companies (company_id, company_name) VALUES (?, ?)", (1, 'ソフトベンチャー'))
        print("会社マスターに初期データを挿入しました。")

        # 取引先マスタ
        clients_data = [('FALCON殿',), ('自社',)]
        cursor.executemany("INSERT INTO clients (client_name) VALUES (?)", clients_data)
        print("取引先マスターに初期データを挿入しました。")

        # 案件マスタ
        # (client_id, project_name)
        projects_data = [
            (1, 'NEC試験'),
            (1, '宮崎業務'),
            (2, '会議'),
            (2, '研修'),
        ]
        cursor.executemany("INSERT INTO projects (client_id, project_name) VALUES (?, ?)", projects_data)
        print("案件マスターに初期データを挿入しました。")

        # 社員マスター
        employees_definitions = [
            (1, 1, '中村　一真', '開発部', 'アルバイト', 0),
            (2, 1, '筑紫　哲也', '研究部', '正社員', 0),
            (3, 1, '営業　よろしく', '営業部', '正社員', 0),
            (4, 1, '高市　早苗', '開発部', '正社員', 0)
        ]
        password_hash = generate_password_hash('123')
        employees_data_to_insert = [emp + (password_hash,) for emp in employees_definitions]
        cursor.executemany("""
            INSERT INTO employees
            (employee_id, company_id, employee_name, department_name, employee_type, retirement_flag, password)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """, employees_data_to_insert)
        print("社員マスターに初期データを挿入しました。")
        
        # 祝日マスター (2025年〜2027年)
        holidays_data = [
            ('2025-01-01', '元日'), ('2025-01-13', '成人の日'), ('2025-02-11', '建国記念の日'),
            ('2025-02-23', '天皇誕生日'), ('2025-02-24', '振替休日'), ('2025-03-20', '春分の日'),
            ('2025-04-29', '昭和の日'), ('2025-05-03', '憲法記念日'), ('2025-05-04', 'みどりの日'),
            ('2025-05-05', 'こどもの日'), ('2025-05-06', '振替休日'), ('2025-07-21', '海の日'),
            ('2025-08-11', '山の日'), ('2025-09-15', '敬老の日'), ('2025-09-23', '秋分の日'),
            ('2025-10-13', 'スポーツの日'), ('2025-11-03', '文化の日'), ('2025-11-23', '勤労感謝の日'),
            ('2025-11-24', '振替休日'),
        ]
        cursor.executemany("INSERT INTO holidays (date, holiday_name) VALUES (?, ?)", holidays_data)
        print(f"祝日マスターに{len(holidays_data)}件のデータを挿入しました。")
        
        connection.commit()
        print("データベースへの変更をコミットしました。")

    except sqlite3.Error as e:
        print(f"データベースエラーが発生しました: {e}")
    finally:
        if 'connection' in locals() and connection:
            connection.close()
            print("データベース接続をクローズしました。")

if __name__ == '__main__':
    print("データベースの初期化を開始します...")
    init_db()
    print("データベースの初期化が完了しました。")
