import os
import logging
from logging.handlers import RotatingFileHandler
from datetime import datetime
from flask import Flask, jsonify, request, g
from flask_cors import CORS
import sqlite3

# -----------------------------------------------------------------------------
# アプリケーション設定
# -----------------------------------------------------------------------------
app = Flask(__name__)
CORS(app)  # CORSを有効にし、フロントエンドからのアクセスを許可

# データベースファイルのパス
DATABASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'database.db')

# -----------------------------------------------------------------------------
# ロギング設定
# -----------------------------------------------------------------------------
def setup_logging():
    """ログ設定を行う"""
    if not os.path.exists('logs'):
        os.mkdir('logs')
    
    log_file_name = f"logs/app_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
    
    # 日本語メッセージを記録するための設定
    handler = RotatingFileHandler(log_file_name, maxBytes=10000, backupCount=5, encoding='utf-8')
    handler.setFormatter(logging.Formatter(
        '%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'
    ))
    
    app.logger.setLevel(logging.INFO)
    app.logger.addHandler(handler)
    app.logger.info('アプリケーション起動')

setup_logging()

# -----------------------------------------------------------------------------
# データベース接続
# -----------------------------------------------------------------------------
def get_db():
    """リクエストごとにデータベース接続を確立し、gオブジェクトに格納する"""
    if 'db' not in g:
        try:
            g.db = sqlite3.connect(DATABASE)
            g.db.row_factory = sqlite3.Row  # カラム名でアクセスできるようにする
            app.logger.info("データベース接続成功")
        except sqlite3.Error as e:
            app.logger.error(f"データベース接続エラー: {e}")
            raise
    return g.db

@app.teardown_appcontext
def close_db(exception):
    """リクエスト終了時にデータベース接続を閉じる"""
    db = g.pop('db', None)
    if db is not None:
        db.close()
        app.logger.info("データベース接続クローズ")

# -----------------------------------------------------------------------------
# APIエンドポイント
# -----------------------------------------------------------------------------

@app.route('/api/employees', methods=['GET'])
def get_employees():
    """社員マスターの全データを取得する"""
    try:
        db = get_db()
        cursor = db.execute('SELECT * FROM employees WHERE retirement_flag = 0')
        employees = [dict(row) for row in cursor.fetchall()]
        app.logger.info(f"{len(employees)}件の社員データを取得しました。")
        return jsonify(employees)
    except Exception as e:
        app.logger.error(f"社員データ取得エラー: {e}")
        return jsonify({"error": "サーバー内部エラー"}), 500

@app.route('/api/companies', methods=['GET'])
def get_companies():
    """会社マスターの全データを取得する"""
    try:
        db = get_db()
        cursor = db.execute('SELECT * FROM companies')
        companies = [dict(row) for row in cursor.fetchall()]
        app.logger.info(f"{len(companies)}件の会社データを取得しました。")
        return jsonify(companies)
    except Exception as e:
        app.logger.error(f"会社データ取得エラー: {e}")
        return jsonify({"error": "サーバー内部エラー"}), 500

@app.route('/api/work_records/<int:employee_id>/<int:year>/<int:month>', methods=['GET'])
def get_work_records(employee_id, year, month):
    """指定された社員IDと年月の作業記録を取得する"""
    try:
        db = get_db()
        query = """
            SELECT 
                CAST(strftime('%d', date) AS INTEGER) as day,
                start_time,
                end_time,
                break_time,
                work_content,
                special_notes
            FROM work_records
            WHERE employee_id = ? AND strftime('%Y', date) = ? AND strftime('%m', date) = ?
        """
        # 年と月を2桁の文字列にフォーマット
        year_str = str(year)
        month_str = f"{month:02d}"

        cursor = db.execute(query, (employee_id, year_str, month_str))
        records = [dict(row) for row in cursor.fetchall()]
        
        # 1件しかない特記事項を取得
        notes_cursor = db.execute("""
            SELECT special_notes FROM work_records
            WHERE employee_id = ? AND strftime('%Y', date) = ? AND strftime('%m', date) = ?
            AND special_notes IS NOT NULL AND special_notes != ''
            LIMIT 1
        """, (employee_id, year_str, month_str))
        special_notes_row = notes_cursor.fetchone()
        special_notes = special_notes_row['special_notes'] if special_notes_row else ""

        app.logger.info(f"作業記録取得: 社員ID={employee_id}, 年月={year}-{month}, {len(records)}件")
        return jsonify({"records": records, "special_notes": special_notes})
    except Exception as e:
        app.logger.error(f"作業記録取得エラー: {e}")
        return jsonify({"error": "サーバー内部エラー"}), 500

@app.route('/api/work_records', methods=['POST'])
def save_work_records():
    """作業記録を保存（更新または新規作成）する"""
    data = request.json
    employee_id = data.get('employee_id')
    year = data.get('year')
    month = data.get('month')
    records = data.get('records')
    special_notes = data.get('special_notes')

    if not all([employee_id, year, month, isinstance(records, list)]):
        app.logger.warning("作業記録保存API: 不正なリクエストデータです。")
        return jsonify({"error": "無効なデータです"}), 400

    try:
        db = get_db()
        cursor = db.cursor()
        
        # 月初の特記事項を更新
        first_day_date_str = f"{year}-{month:02d}-01"

        # まず、その月の特記事項を一旦すべてクリア
        cursor.execute("""
            UPDATE work_records
            SET special_notes = NULL
            WHERE employee_id = ? AND strftime('%Y-%m', date) = ?
        """, (employee_id, f"{year}-{month:02d}"))
        
        for record in records:
            day = record.get('day')
            if day is None:
                continue
            date_str = f"{year}-{month:02d}-{day:02d}"
            
            # 該当日のレコードが存在するかチェック
            cursor.execute("SELECT 1 FROM work_records WHERE employee_id = ? AND date = ?", (employee_id, date_str))
            exists = cursor.fetchone()

            current_special_notes = special_notes if int(day) == 1 else None

            if exists:
                # 更新
                cursor.execute("""
                    UPDATE work_records
                    SET start_time = ?, end_time = ?, break_time = ?, work_content = ?, special_notes = ?
                    WHERE employee_id = ? AND date = ?
                """, (
                    record.get('start_time'), record.get('end_time'), record.get('break_time'), 
                    record.get('work_content'), current_special_notes,
                    employee_id, date_str
                ))
            else:
                # 新規作成
                cursor.execute("""
                    INSERT INTO work_records (employee_id, date, start_time, end_time, break_time, work_content, special_notes)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (
                    employee_id, date_str, record.get('start_time'), record.get('end_time'),
                    record.get('break_time'), record.get('work_content'), current_special_notes
                ))
        
        db.commit()
        app.logger.info(f"作業記録保存成功: 社員ID={employee_id}, 年月={year}-{month}")
        return jsonify({"message": "保存しました"}), 200
    except sqlite3.Error as e:
        db.rollback()
        app.logger.error(f"作業記録保存エラー (DB): {e}")
        return jsonify({"error": "データベースエラー"}), 500
    except Exception as e:
        db.rollback()
        app.logger.error(f"作業記録保存エラー: {e}")
        return jsonify({"error": "サーバー内部エラー"}), 500


@app.route('/api/holidays/<int:year>', methods=['GET'])
def get_holidays(year):
    """指定された年の祝日リストを取得する"""
    try:
        db = get_db()
        cursor = db.execute("SELECT date, holiday_name FROM holidays WHERE strftime('%Y', date) = ?", (str(year),))
        holidays = {row['date']: row['holiday_name'] for row in cursor.fetchall()}
        app.logger.info(f"{year}年の祝日データを{len(holidays)}件取得しました。")
        return jsonify(holidays)
    except Exception as e:
        app.logger.error(f"祝日データ取得エラー: {e}")
        return jsonify({"error": "サーバー内部エラー"}), 500

@app.route('/api/daily_report/<int:employee_id>/<string:date_str>', methods=['GET'])
def get_daily_report(employee_id, date_str):
    """指定された社員IDと日付の日報データを取得する"""
    try:
        db = get_db()
        cursor = db.execute(
            'SELECT * FROM daily_reports WHERE employee_id = ? AND date = ?',
            (employee_id, date_str)
        )
        report = cursor.fetchone()
        if report:
            app.logger.info(f"日報データ取得成功: 社員ID={employee_id}, 日付={date_str}")
            return jsonify(dict(report))
        else:
            app.logger.info(f"日報データなし: 社員ID={employee_id}, 日付={date_str}")
            return jsonify(None)
    except Exception as e:
        app.logger.error(f"日報データ取得エラー: {e}")
        return jsonify({"error": "サーバー内部エラー"}), 500

@app.route('/api/daily_report', methods=['POST'])
def save_daily_report():
    """日報データを保存（更新または新規作成）する"""
    data = request.json
    employee_id = data.get('employee_id')
    date = data.get('date')

    if not all([employee_id, date]):
        return jsonify({"error": "無効なデータです"}), 400

    try:
        db = get_db()
        cursor = db.cursor()
        cursor.execute("SELECT 1 FROM daily_reports WHERE employee_id = ? AND date = ?", (employee_id, date))
        exists = cursor.fetchone()

        if exists:
            # 更新
            cursor.execute("""
                UPDATE daily_reports SET
                work_summary = ?, problems = ?, challenges = ?, tomorrow_tasks = ?, thoughts = ?
                WHERE employee_id = ? AND date = ?
            """, (
                data.get('work_summary'), data.get('problems'), data.get('challenges'),
                data.get('tomorrow_tasks'), data.get('thoughts'),
                employee_id, date
            ))
        else:
            # 新規作成
            cursor.execute("""
                INSERT INTO daily_reports 
                (employee_id, date, work_summary, problems, challenges, tomorrow_tasks, thoughts)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                employee_id, date, data.get('work_summary'), data.get('problems'),
                data.get('challenges'), data.get('tomorrow_tasks'), data.get('thoughts')
            ))
        
        db.commit()
        app.logger.info(f"日報データ保存成功: 社員ID={employee_id}, 日付={date}")
        return jsonify({"message": "日報を保存しました"}), 200
    except Exception as e:
        db.rollback()
        app.logger.error(f"日報データ保存エラー: {e}")
        return jsonify({"error": "サーバー内部エラー"}), 500

@app.route('/api/employee', methods=['POST'])
def add_employee():
    """新しい社員を追加する"""
    data = request.json
    try:
        db = get_db()
        cursor = db.cursor()
        cursor.execute("""
            INSERT INTO employees (company_id, employee_name, department_name, employee_type, retirement_flag)
            VALUES (?, ?, ?, ?, 0)
        """, (
            data.get('company_id', 1), # ソフトベンチャーに固定
            data.get('employee_name'),
            data.get('department_name'),
            data.get('employee_type')
        ))
        db.commit()
        new_id = cursor.lastrowid
        app.logger.info(f"新規社員追加成功: {data.get('employee_name')}, ID={new_id}")
        return jsonify({"message": "社員を追加しました", "employee_id": new_id}), 201
    except Exception as e:
        db.rollback()
        app.logger.error(f"社員追加エラー: {e}")
        return jsonify({"error": "サーバー内部エラー"}), 500

@app.route('/api/employee/<int:employee_id>', methods=['PUT'])
def update_employee(employee_id):
    """社員情報を更新する"""
    data = request.json
    try:
        db = get_db()
        cursor = db.cursor()
        cursor.execute("""
            UPDATE employees SET
            employee_name = ?, department_name = ?, employee_type = ?, retirement_flag = ?
            WHERE employee_id = ?
        """, (
            data.get('employee_name'),
            data.get('department_name'),
            data.get('employee_type'),
            1 if data.get('retirement_flag') else 0,
            employee_id
        ))
        db.commit()
        app.logger.info(f"社員情報更新成功: ID={employee_id}")
        return jsonify({"message": "社員情報を更新しました"}), 200
    except Exception as e:
        db.rollback()
        app.logger.error(f"社員情報更新エラー: {e}")
        return jsonify({"error": "サーバー内部エラー"}), 500

if __name__ == '__main__':
    app.run(debug=True)
