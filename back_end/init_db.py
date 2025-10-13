import sqlite3
import os
from werkzeug.security import generate_password_hash

# このスクリプトの場所を基準にデータベースファイルのパスを決定
db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'database.db')
schema_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'schema.sql')

def init_db():
    """データベースを初期化し、スキーマを適用して初期データを挿入します。

    この関数は、アプリケーションのデータベースをセットアップするために使用されます。
    実行されると、以下の処理を順次行います。
    1. 既存のデータベースファイル (`database.db`) があれば削除します。
    2. 新しいデータベースファイルを作成し、接続します。
    3. `schema.sql` ファイルからSQLスキーマを読み込み、テーブルを作成します。
    4. `companies`, `employees`, `holidays` テーブルに初期データを挿入します。
       - `master_flag`が1の社員には、初期パスワードとして '123' が設定されます。

    Raises:
        sqlite3.Error: データベース操作中にエラーが発生した場合。
    """
    try:
        # データベースファイルが既に存在する場合は削除して作り直す
        if os.path.exists(db_path):
            os.remove(db_path)
            print("既存のデータベースファイルを削除しました。")

        # データベースに接続（ファイルがなければ新規作成される）
        connection = sqlite3.connect(db_path)
        print("データベースに接続しました。")

        # schema.sqlファイルを開き、SQLコマンドを実行
        with open(schema_path, 'r', encoding='utf-8') as f:
            connection.executescript(f.read())
        print("データベーススキーマを適用しました。")

        cursor = connection.cursor()

        # --- 初期データの挿入 ---

        # 会社マスター
        cursor.execute("INSERT INTO companies (company_id, company_name) VALUES (?, ?)",
                       (1, 'ソフトベンチャー'))
        print("会社マスターに初期データを挿入しました。")

        # 社員マスター
        # master_flagが1のユーザーには、ハッシュ化された初期パスワード'123'を設定します。
        employees_definitions = [
            # (employee_id, company_id, employee_name, department_name, employee_type, retirement_flag, master_flag)
            (1, 1, '中村　一真', '開発部', 'アルバイト', 0, 1),
            (2, 1, '筑紫　哲也', '研究部', '正社員', 0, 0),
            (3, 1, '営業　よろしく', '営業部', '正社員', 0, 1),
            (4, 1, '高市　早苗', '開発部', '正社員', 0, 0)
        ]

        employees_data_to_insert = []
        for emp in employees_definitions:
            password_hash = generate_password_hash('123') if emp[6] == 1 else None
            employees_data_to_insert.append(emp + (password_hash,))

        cursor.executemany("""
            INSERT INTO employees
            (employee_id, company_id, employee_name, department_name, employee_type, retirement_flag, master_flag, password)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, employees_data_to_insert)
        print("社員マスターに初期データを挿入しました。")
        
        # 祝日マスター (2025年〜2027年)
        holidays_data = [
            # 2025年
            ('2025-01-01', '元日'), ('2025-01-13', '成人の日'), ('2025-02-11', '建国記念の日'),
            ('2025-02-23', '天皇誕生日'), ('2025-02-24', '振替休日'), ('2025-03-20', '春分の日'),
            ('2025-04-29', '昭和の日'), ('2025-05-03', '憲法記念日'), ('2025-05-04', 'みどりの日'),
            ('2025-05-05', 'こどもの日'), ('2025-05-06', '振替休日'), ('2025-07-21', '海の日'),
            ('2025-08-11', '山の日'), ('2025-09-15', '敬老の日'), ('2025-09-23', '秋分の日'),
            ('2025-10-13', 'スポーツの日'), ('2025-11-03', '文化の日'), ('2025-11-23', '勤労感謝の日'),
            ('2025-11-24', '振替休日'),
            # 2026年
            ('2026-01-01', '元日'), ('2026-01-12', '成人の日'), ('2026-02-11', '建国記念の日'),
            ('2026-02-23', '天皇誕生日'), ('2026-03-20', '春分の日'), ('2026-04-29', '昭和の日'),
            ('2026-05-03', '憲法記念日'), ('2026-05-04', 'みどりの日'), ('2026-05-05', 'こどもの日'),
            ('2026-05-06', '振替休日'), ('2026-07-20', '海の日'), ('2026-08-11', '山の日'),
            ('2026-09-21', '敬老の日'), ('2026-09-23', '秋分の日'), ('2026-10-12', 'スポーツの日'),
            ('2026-11-03', '文化の日'), ('2026-11-23', '勤労感謝の日'),
            # 2027年
            ('2027-01-01', '元日'), ('2027-01-11', '成人の日'), ('2027-02-11', '建国記念の日'),
            ('2027-02-23', '天皇誕生日'), ('2027-03-21', '春分の日'), ('2027-03-22', '振替休日'),
            ('2027-04-29', '昭和の日'), ('2027-05-03', '憲法記念日'), ('2027-05-04', 'みどりの日'),
            ('2027-05-05', 'こどもの日'), ('2027-07-19', '海の日'), ('2027-08-11', '山の日'),
            ('2027-09-20', '敬老の日'), ('2027-09-23', '秋分の日'), ('2027-10-11', 'スポーツの日'),
            ('2027-11-03', '文化の日'), ('2027-11-23', '勤労感謝の日')
        ]
        cursor.executemany("INSERT INTO holidays (date, holiday_name) VALUES (?, ?)", holidays_data)
        print(f"祝日マスターに{len(holidays_data)}件のデータを挿入しました。")
        
        # 変更をコミット
        connection.commit()
        print("データベースへの変更をコミットしました。")

    except sqlite3.Error as e:
        print(f"データベースエラーが発生しました: {e}")
    finally:
        # 接続を閉じる
        if 'connection' in locals() and connection:
            connection.close()
            print("データベース接続をクローズしました。")

if __name__ == '__main__':
    print("データベースの初期化を開始します...")
    init_db()
    print("データベースの初期化が完了しました。")
