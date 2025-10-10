import os
import logging
from logging.handlers import RotatingFileHandler
from datetime import datetime
import calendar
from flask import Flask, jsonify, request, g, send_from_directory
from flask_cors import CORS
import sqlite3

# 外部の勤怠計算モジュールをインポート
from attendance_calculator import AttendanceCalculator

# -----------------------------------------------------------------------------
# アプリケーション設定
# -----------------------------------------------------------------------------
# Flaskアプリケーションのインスタンスを作成
# static_folder='../front_end/dist' は、本番環境でReactのビルド成果物 (静的ファイル) を
# Flaskから直接配信するための設定。'../front_end/dist'ディレクトリを静的フォルダとして指定。
app = Flask(__name__, static_folder='../front_end/dist')

# CORS (Cross-Origin Resource Sharing) を有効にする
# これにより、異なるオリジン (この場合はフロントエンドの開発サーバー) からのAPIリクエストを受け付けることができる
CORS(app)

# データベースファイルの絶対パスを構築
# __file__ はこのスクリプトのパスを指し、os.path.dirnameでディレクトリ名を取得
DATABASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'database.db')

# -----------------------------------------------------------------------------
# ロギング設定
# -----------------------------------------------------------------------------
def setup_logging():
    """
    アプリケーションのログ出力に関する設定を行う関数。
    - 'logs' ディレクトリがなければ作成する。
    - 起動日時を含むログファイル名で、ローテーションするファイルハンドラを設定する。
    - ログのフォーマットを定義し、アプリケーションロガーに追加する。
    """
    # ログファイルを保存する 'logs' ディレクトリがなければ作成
    if not os.path.exists('logs'):
        os.mkdir('logs')
    
    # タイムスタンプ付きのログファイル名を生成
    log_file_name = f"logs/app_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
    
    # RotatingFileHandlerを設定。ファイルサイズが10KBを超えると新しいファイルを作成し、5世代までバックアップ。
    # encoding='utf-8'で日本語のログメッセージが文字化けしないようにする。
    handler = RotatingFileHandler(log_file_name, maxBytes=10000, backupCount=5, encoding='utf-8')
    handler.setFormatter(logging.Formatter(
        '%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'
    ))
    
    # アプリケーションのロガーレベルをINFOに設定し、作成したハンドラを追加
    app.logger.setLevel(logging.INFO)
    app.logger.addHandler(handler)
    app.logger.info('アプリケーション起動ログ')

# アプリケーション起動時にロギング設定を実行
setup_logging()

# -----------------------------------------------------------------------------
# データベース接続管理
# -----------------------------------------------------------------------------
def get_db():
    """
    リクエストコンテキスト内で単一のデータベース接続を確保・提供する。
    - Flaskの 'g' (global) オブジェクトを使用して、リクエスト内で接続を再利用する。
    - 接続が存在しない場合のみ、新しい接続を確立する。
    - 'sqlite3.Row' を row_factory に設定し、結果を辞書のようにカラム名でアクセスできるようにする。
    """
    if 'db' not in g:
        try:
            g.db = sqlite3.connect(DATABASE)
            g.db.row_factory = sqlite3.Row
            app.logger.info("データベース接続を確立しました。")
        except sqlite3.Error as e:
            app.logger.error(f"データベース接続エラー: {e}")
            raise  # エラーが発生した場合は例外を再送出
    return g.db

@app.teardown_appcontext
def close_db(exception):
    """
    リクエストの終了時 (teardown) に自動的にデータベース接続を閉じる。
    - 'g' オブジェクトからデータベース接続を取り出し、存在すればクローズする。
    - これにより、接続リークを防ぐ。
    """
    db = g.pop('db', None)
    if db is not None:
        db.close()
        app.logger.info("データベース接続をクローズしました。")

# -----------------------------------------------------------------------------
# APIエンドポイント: マスターデータ関連
# -----------------------------------------------------------------------------

@app.route('/api/employees', methods=['GET'])
def get_employees():
    """
    作業報告書の氏名プルダウン用に、マスター権限を持つ在籍中の社員リストを取得する。
    Returns:
        Response: 社員オブジェクトのリストを含むJSONレスポンス。
    """
    try:
        db = get_db()
        # master_flagが1 (マスター) かつ retirement_flagが0 (在籍中) の社員を取得
        cursor = db.execute('SELECT * FROM employees WHERE master_flag = 1 AND retirement_flag = 0 ORDER BY employee_id')
        employees = [dict(row) for row in cursor.fetchall()]
        # セキュリティのため、パスワードはレスポンスに含めない
        for emp in employees:
            emp.pop('password', None)
        app.logger.info(f"{len(employees)}件のマスター権限を持つ社員データを取得しました。")
        return jsonify(employees)
    except Exception as e:
        app.logger.error(f"マスター社員データ取得エラー: {e}")
        return jsonify({"error": "サーバー内部エラー"}), 500

@app.route('/api/employees/all', methods=['GET'])
def get_all_employees():
    """
    マスターメンテナンス用に、全社員のリストを取得する。（パスワードは含まない）
    Returns:
        Response: 社員オブジェクトのリストを含むJSONレスポンス。
    """
    try:
        db = get_db()
        # パスワードを除いた全カラムを取得
        cursor = db.execute('SELECT employee_id, company_id, employee_name, department_name, employee_type, retirement_flag, master_flag FROM employees ORDER BY employee_id')
        employees = [dict(row) for row in cursor.fetchall()]
        app.logger.info(f"全社員データ（マスター用）を{len(employees)}件取得しました。")
        return jsonify(employees)
    except Exception as e:
        app.logger.error(f"全社員データ取得エラー: {e}")
        return jsonify({"error": "サーバー内部エラー"}), 500

@app.route('/api/master/authenticate', methods=['POST'])
def authenticate_master():
    """
    マスターメンテナンスの認証を行う。
    成功した場合、そのユーザーがオーナーかどうかのフラグも返す。
    Request Body (JSON):
        { "employee_id": int, "password": str }
    Returns:
        Response: { "success": bool, "message": str, "is_owner": bool }
    """
    data = request.json
    employee_id = data.get('employee_id')
    password = data.get('password')

    if not employee_id or not password:
        return jsonify({"error": "IDとパスワードは必須です"}), 400

    try:
        db = get_db()
        cursor = db.execute(
            'SELECT password, master_flag FROM employees WHERE employee_id = ?',
            (employee_id,)
        )
        user = cursor.fetchone()

        if user and user['password'] == password:
            is_master = user['master_flag'] == 1
            # オーナーは employee_id が 1 のユーザーとして定義
            is_owner = is_master and (int(employee_id) == 1)

            if not is_master:
                app.logger.warning(f"認証試行（マスター権限なし）: 社員ID={employee_id}")
                # is_master: false を返すことで、フロント側で制御できるようにする
                return jsonify({"success": True, "is_master": False, "is_owner": False}), 200

            app.logger.info(f"マスター認証成功: 社員ID={employee_id}, オーナー={is_owner}")
            return jsonify({
                "success": True,
                "message": "認証に成功しました",
                "is_master": True,
                "is_owner": is_owner
            }), 200
        else:
            app.logger.warning(f"マスター認証失敗: 社員ID={employee_id}")
            return jsonify({"success": False, "message": "認証情報が正しくありません"}), 401

    except Exception as e:
        app.logger.error(f"マスター認証エラー: {e}")
        return jsonify({"error": "サーバー内部エラー"}), 500

@app.route('/api/companies', methods=['GET'])
def get_companies():
    """
    会社マスターの全データを取得する。

    Returns:
        Response: 会社オブジェクトのリストを含むJSONレスポンス。
                  例: [{"company_id": 1, "company_name": "株式会社ABC"}, ...]
    """
    try:
        db = get_db()
        cursor = db.execute('SELECT * FROM companies')
        companies = [dict(row) for row in cursor.fetchall()]
        app.logger.info(f"{len(companies)}件の会社データを取得しました。")
        return jsonify(companies)
    except Exception as e:
        app.logger.error(f"会社データ取得エラー: {e}")
        return jsonify({"error": "サーバー内部エラー"}), 500

@app.route('/api/holidays/<int:year>', methods=['GET'])
def get_holidays(year):
    """
    指定された年の祝日リストをデータベースから取得する。

    Args:
        year (int): 祝日を取得する対象の年。

    Returns:
        Response: 日付をキー、祝日名を値とする辞書形式のJSONレスポンス。
                  例: {"2025-01-01": "元日", "2025-10-13": "スポーツの日"}
    """
    try:
        db = get_db()
        cursor = db.execute("SELECT date, holiday_name FROM holidays WHERE strftime('%Y', date) = ?", (str(year),))
        # 取得したデータを {日付: 祝日名} の形式の辞書に変換
        holidays = {row['date']: row['holiday_name'] for row in cursor.fetchall()}
        app.logger.info(f"{year}年の祝日データを{len(holidays)}件取得しました。")
        return jsonify(holidays)
    except Exception as e:
        app.logger.error(f"祝日データ取得エラー: {e}")
        return jsonify({"error": "サーバー内部エラー"}), 500

# -----------------------------------------------------------------------------
# APIエンドポイント: 作業報告書関連
# -----------------------------------------------------------------------------

@app.route('/api/work_records/<int:employee_id>/<int:year>/<int:month>', methods=['GET'])
def get_work_records(employee_id, year, month):
    """
    指定された社員IDと年月の作業記録および月次の特記事項を取得する。
    作業報告書画面の初期表示に使用される。

    Args:
        employee_id (int): 社員ID。
        year (int): 対象年。
        month (int): 対象月。

    Returns:
        Response: 日次記録のリストと特記事項を含むJSONレスポンス。
                  例: {
                        "records": [{"day": 1, "start_time": "09:00", ...}, ...],
                        "special_notes": "月次報告です。"
                      }
    """
    try:
        db = get_db()
        year_str = str(year)
        month_str = f"{month:02d}"  # 月を2桁の文字列にフォーマット

        # 1. 指定された年月の全日次記録を取得
        records_cursor = db.execute("""
            SELECT CAST(strftime('%d', date) AS INTEGER) as day, start_time, end_time, break_time, work_content
            FROM work_records
            WHERE employee_id = ? AND strftime('%Y', date) = ? AND strftime('%m', date) = ?
        """, (employee_id, year_str, month_str))
        records = [dict(row) for row in records_cursor.fetchall()]

        # 2. 該当月の特記事項を取得
        notes_cursor = db.execute("""
            SELECT special_notes FROM monthly_reports
            WHERE employee_id = ? AND year = ? AND month = ?
        """, (employee_id, year, month))
        notes_row = notes_cursor.fetchone()
        special_notes = notes_row['special_notes'] if notes_row else ""

        app.logger.info(f"作業記録取得: 社員ID={employee_id}, 年月={year}-{month}, {len(records)}件")
        return jsonify({"records": records, "special_notes": special_notes})
    except Exception as e:
        app.logger.error(f"作業記録取得エラー: {e}")
        return jsonify({"error": "サーバー内部エラー"}), 500

@app.route('/api/work_records', methods=['POST'])
def save_work_records():
    """
    作業報告書画面からの入力に基づき、日次の作業記録と月次の特記事項を保存する。
    データが存在しない場合は新規作成 (INSERT)、存在する場合は更新 (UPDATE) する (UPSERT)。

    Request Body (JSON):
        {
            "employee_id": int,
            "year": int,
            "month": int,
            "records": [{"day": int, "start_time": str, ...}, ...],
            "special_notes": str
        }

    Returns:
        Response: 保存成功メッセージを含むJSONレスポンス。
    """
    data = request.json
    employee_id = data.get('employee_id')
    year = data.get('year')
    month = data.get('month')
    records = data.get('records')
    special_notes = data.get('special_notes')

    # 必須パラメータの存在チェック
    if not all([employee_id, year, month, isinstance(records, list)]):
        app.logger.warning("作業記録保存API: 不正なリクエストデータです。")
        return jsonify({"error": "無効なデータです"}), 400

    db = get_db()
    try:
        # トランザクション開始
        # 1. 特記事項の保存 (UPSERT)
        cursor = db.execute(
            "SELECT report_id FROM monthly_reports WHERE employee_id = ? AND year = ? AND month = ?",
            (employee_id, year, month)
        )
        report_row = cursor.fetchone()
        if report_row: # 既存データがあれば更新
            db.execute(
                "UPDATE monthly_reports SET special_notes = ? WHERE report_id = ?",
                (special_notes, report_row['report_id'])
            )
        else: # なければ新規作成
            db.execute(
                "INSERT INTO monthly_reports (employee_id, year, month, special_notes) VALUES (?, ?, ?, ?)",
                (employee_id, year, month, special_notes)
            )

        # 2. 日次作業記録の保存 (UPSERT)
        for record in records:
            day = record.get('day')
            if day is None: continue # 日付がないデータはスキップ

            date_str = f"{year}-{month:02d}-{day:02d}"
            
            cursor = db.execute(
                "SELECT record_id FROM work_records WHERE employee_id = ? AND date = ?",
                (employee_id, date_str)
            )
            record_row = cursor.fetchone()

            if record_row: # 既存レコードがあれば更新
                db.execute("""
                    UPDATE work_records
                    SET start_time = ?, end_time = ?, break_time = ?, work_content = ?
                    WHERE record_id = ?
                """, (
                    record.get('start_time'), record.get('end_time'),
                    record.get('break_time'), record.get('work_content'),
                    record_row['record_id']
                ))
            else: # なければ新規作成
                db.execute("""
                    INSERT INTO work_records (employee_id, date, start_time, end_time, break_time, work_content)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (
                    employee_id, date_str, record.get('start_time'), record.get('end_time'),
                    record.get('break_time'), record.get('work_content')
                ))

        db.commit() # トランザクションをコミット
        app.logger.info(f"作業記録保存成功: 社員ID={employee_id}, 年月={year}-{month}")
        return jsonify({"message": "保存しました"}), 200
    except sqlite3.Error as e:
        db.rollback() # エラーが発生した場合はロールバック
        app.logger.error(f"作業記録保存エラー (DB): {e}")
        return jsonify({"error": "データベースエラー"}), 500
    except Exception as e:
        db.rollback()
        app.logger.error(f"作業記録保存エラー: {e}")
        return jsonify({"error": "サーバー内部エラー"}), 500

# -----------------------------------------------------------------------------
# APIエンドポイント: 勤怠管理表関連
# -----------------------------------------------------------------------------

@app.route('/api/attendance_records/<int:employee_id>/<int:year>/<int:month>', methods=['GET'])
def get_attendance_records(employee_id, year, month):
    """
    指定された社員と年月の勤怠データを、日次・月次集計と共に取得する。
    このAPIは勤怠管理表画面の表示に必要な全ての計算済みデータを返す。

    Args:
        employee_id (int): 社員ID。
        year (int): 対象年。
        month (int): 対象月。

    Returns:
        Response: 日次記録のリストと月次集計を含むJSONレスポンス。
                  日次記録にはDBの値と計算結果の両方が含まれる。
    """
    try:
        db = get_db()
        calculator = AttendanceCalculator()

        # 1. 該当月のDB上の作業記録を全て取得し、日付をキーとする辞書に格納
        cursor = db.execute("""
            SELECT * FROM work_records
            WHERE employee_id = ? AND strftime('%Y', date) = ? AND strftime('%m', date) = ?
        """, (employee_id, f"{year:04d}", f"{month:02d}"))
        records_map = {int(row['date'].split('-')[2]): dict(row) for row in cursor.fetchall()}

        # 2. 該当年の祝日をセットとして取得（高速な存在チェックのため）
        cursor = db.execute("SELECT date FROM holidays WHERE strftime('%Y', date) = ?", (f"{year:04d}",))
        holidays_set = {row['date'] for row in cursor.fetchall()}

        # 3. 月の日数分ループし、各日の日次データを生成
        _, num_days = calendar.monthrange(year, month)
        all_daily_data = []

        for day in range(1, num_days + 1):
            date_str = f"{year:04d}-{month:02d}-{day:02d}"
            db_record = records_map.get(day, {}) # DBに記録がなければ空の辞書

            # 曜日とカレンダー上の休日（土日または祝日）かを判定
            weekday = datetime(year, month, day).weekday() # 0=月, 6=日
            is_holiday_from_calendar = date_str in holidays_set or weekday in [5, 6]

            # 勤怠計算モジュールへの入力データを作成
            calc_input = {
                'start_time': db_record.get('start_time'),
                'end_time': db_record.get('end_time'),
                'break_time': db_record.get('break_time'),
                'night_break_time': db_record.get('night_break_time'),
                'holiday_type': db_record.get('holiday_type'),
                'is_holiday_from_calendar': is_holiday_from_calendar
            }
            # 日次サマリーを計算
            daily_summary = calculator.calculate_daily_summary(calc_input)

            # フロントエンドに返すための日次データオブジェクトを構築
            daily_data = {
                "day": day,
                "date": date_str,
                "weekday": weekday,
                # --- DBからの入力値 ---
                "holiday_type": db_record.get('holiday_type'), # 法定休日/所定休日
                "attendance_type": db_record.get('attendance_type'), # 出勤/休暇など
                "start_time": db_record.get('start_time'),
                "end_time": db_record.get('end_time'),
                "break_time": db_record.get('break_time'),
                "night_break_time": db_record.get('night_break_time'),
                "remarks": db_record.get('work_content'), # 備考欄
                # --- 計算結果 ---
                "daily_summary": daily_summary
            }
            all_daily_data.append(daily_data)

        # 4. 全日次データを元に月次サマリーを計算
        monthly_summary = calculator.calculate_monthly_summary(all_daily_data)

        app.logger.info(f"勤怠データ取得成功: 社員ID={employee_id}, 年月={year}-{month}")
        return jsonify({
            "daily_records": all_daily_data,
            "monthly_summary": monthly_summary
        })

    except Exception as e:
        app.logger.error(f"勤怠データ取得エラー: {e}")
        import traceback
        traceback.print_exc() # 詳細なトレースバックをログに出力
        return jsonify({"error": "サーバー内部エラー"}), 500

@app.route('/api/attendance_records', methods=['POST'])
def save_attendance_records():
    """
    勤怠管理表からの入力に基づき、日次の勤怠データを保存する (UPSERT)。
    作業報告書とは異なり、勤怠種別や深夜休憩など、より詳細な情報を保存する。

    Request Body (JSON):
        {
            "employee_id": int,
            "records": [{"date": str, "start_time": str, "holiday_type": int, ...}, ...]
        }

    Returns:
        Response: 保存成功メッセージを含むJSONレスポンス。
    """
    data = request.json
    employee_id = data.get('employee_id')
    records = data.get('records')

    if not all([employee_id, isinstance(records, list)]):
        app.logger.warning("勤怠データ保存API: 不正なリクエストデータです。")
        return jsonify({"error": "無効なデータです"}), 400

    db = get_db()
    try:
        for record in records:
            date_str = record.get('date')
            if not date_str: continue # 日付がなければスキップ

            # 既存レコードの存在を確認
            cursor = db.execute(
                "SELECT record_id FROM work_records WHERE employee_id = ? AND date = ?",
                (employee_id, date_str)
            )
            record_row = cursor.fetchone()

            # 保存するデータを辞書として準備
            params = {
                'employee_id': employee_id,
                'date': date_str,
                'holiday_type': record.get('holiday_type'),
                'attendance_type': record.get('attendance_type'),
                'start_time': record.get('start_time'),
                'end_time': record.get('end_time'),
                'break_time': record.get('break_time'),
                'night_break_time': record.get('night_break_time'),
                'work_content': record.get('remarks') # 備考
            }

            if record_row: # 既存レコードがあれば更新
                params['record_id'] = record_row['record_id']
                db.execute("""
                    UPDATE work_records SET
                    holiday_type=:holiday_type, attendance_type=:attendance_type, start_time=:start_time,
                    end_time=:end_time, break_time=:break_time, night_break_time=:night_break_time,
                    work_content=:work_content
                    WHERE record_id=:record_id
                """, params)
            else: # なければ新規作成
                db.execute("""
                    INSERT INTO work_records (
                        employee_id, date, holiday_type, attendance_type, start_time,
                        end_time, break_time, night_break_time, work_content
                    ) VALUES (
                        :employee_id, :date, :holiday_type, :attendance_type, :start_time,
                        :end_time, :break_time, :night_break_time, :work_content
                    )
                """, params)

        db.commit()
        app.logger.info(f"勤怠データ保存成功: 社員ID={employee_id}")
        return jsonify({"message": "保存しました"}), 200
    except sqlite3.Error as e:
        db.rollback()
        app.logger.error(f"勤怠データ保存エラー (DB): {e}")
        return jsonify({"error": "データベースエラー"}), 500
    except Exception as e:
        db.rollback()
        app.logger.error(f"勤怠データ保存エラー: {e}")
        return jsonify({"error": "サーバー内部エラー"}), 500

# -----------------------------------------------------------------------------
# APIエンドポイント: 日報関連
# -----------------------------------------------------------------------------

@app.route('/api/daily_report/<int:employee_id>/<string:date_str>', methods=['GET'])
def get_daily_report(employee_id, date_str):
    """
    指定された社員IDと日付の日報データを取得する。

    Args:
        employee_id (int): 社員ID。
        date_str (str): 日付文字列 (YYYY-MM-DD)。

    Returns:
        Response: 日報データオブジェクト、または存在しない場合はnullを含むJSONレスポンス。
    """
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
            return jsonify(None) # データが存在しない場合はnullを返す
    except Exception as e:
        app.logger.error(f"日報データ取得エラー: {e}")
        return jsonify({"error": "サーバー内部エラー"}), 500

@app.route('/api/daily_report', methods=['POST'])
def save_daily_report():
    """
    日報データを保存する (UPSERT)。

    Request Body (JSON):
        {
            "employee_id": int,
            "date": str,
            "work_summary": str,
            "problems": str,
            "challenges": str,
            "tomorrow_tasks": str,
            "thoughts": str
        }

    Returns:
        Response: 保存成功メッセージを含むJSONレスポンス。
    """
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

        if exists: # 既存データがあれば更新
            cursor.execute("""
                UPDATE daily_reports SET
                work_summary = ?, problems = ?, challenges = ?, tomorrow_tasks = ?, thoughts = ?
                WHERE employee_id = ? AND date = ?
            """, (
                data.get('work_summary'), data.get('problems'), data.get('challenges'),
                data.get('tomorrow_tasks'), data.get('thoughts'),
                employee_id, date
            ))
        else: # なければ新規作成
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

# -----------------------------------------------------------------------------
# APIエンドポイント: 社員マスターメンテナンス
# -----------------------------------------------------------------------------

@app.route('/api/employee', methods=['POST'])
def add_employee():
    """
    マスターメンテナンス画面から新しい社員を追加する。オーナー権限が必要。

    Request Body (JSON):
        {
            "owner_id": 1, // オーナーのID
            "employee_name": str,
            "department_name": str,
            ...
        }
    """
    data = request.json

    # オーナー権限チェック
    if data.get('owner_id') != 1:
        app.logger.warning(f"社員追加API: 権限のないアクセス試行。owner_id={data.get('owner_id')}")
        return jsonify({"error": "この操作を行う権限がありません"}), 403

    try:
        db = get_db()
        cursor = db.cursor()
        cursor.execute("""
            INSERT INTO employees (company_id, employee_name, department_name, employee_type, retirement_flag)
            VALUES (?, ?, ?, ?, 0)
        """, (
            data.get('company_id', 1), # デフォルトはソフトベンチャー(ID=1)
            data.get('employee_name'),
            data.get('department_name'),
            data.get('employee_type')
        ))
        db.commit()
        new_id = cursor.lastrowid # 新しく採番されたIDを取得
        app.logger.info(f"新規社員追加成功: {data.get('employee_name')}, ID={new_id}")
        return jsonify({"message": "社員を追加しました", "employee_id": new_id}), 201
    except Exception as e:
        db.rollback()
        app.logger.error(f"社員追加エラー: {e}")
        return jsonify({"error": "サーバー内部エラー"}), 500

@app.route('/api/employee/<int:employee_id>', methods=['PUT'])
def update_employee(employee_id):
    """
    マスターメンテナンス画面から既存の社員情報を更新する。オーナー権限が必要。
    パスワードがリクエストに含まれ、かつ空文字列でない場合のみパスワードを更新する。
    """
    data = request.json

    # オーナー権限チェック
    if data.get('owner_id') != 1:
        app.logger.warning(f"社員更新API: 権限のないアクセス試行。owner_id={data.get('owner_id')}")
        return jsonify({"error": "この操作を行う権限がありません"}), 403

    try:
        db = get_db()

        # パスワードが提供され、空文字列でない場合のみ更新する
        if data.get('password'):
            db.execute("""
                UPDATE employees SET
                employee_name = ?, department_name = ?, employee_type = ?,
                retirement_flag = ?, master_flag = ?, password = ?
                WHERE employee_id = ?
            """, (
                data.get('employee_name'),
                data.get('department_name'),
                data.get('employee_type'),
                1 if data.get('retirement_flag') else 0,
                1 if data.get('master_flag') else 0,
                data.get('password'),
                employee_id
            ))
            app.logger.info(f"社員情報（パスワードを含む）を更新しました: ID={employee_id}")
        else: # パスワードを更新しない場合
            db.execute("""
                UPDATE employees SET
                employee_name = ?, department_name = ?, employee_type = ?,
                retirement_flag = ?, master_flag = ?
                WHERE employee_id = ?
            """, (
                data.get('employee_name'),
                data.get('department_name'),
                data.get('employee_type'),
                1 if data.get('retirement_flag') else 0,
                1 if data.get('master_flag') else 0,
                employee_id
            ))
            app.logger.info(f"社員情報（パスワードを除く）を更新しました: ID={employee_id}")

        db.commit()
        return jsonify({"message": "社員情報を更新しました"}), 200
    except Exception as e:
        db.rollback()
        app.logger.error(f"社員情報更新エラー: {e}")
        return jsonify({"error": "サーバー内部エラー"}), 500

# -----------------------------------------------------------------------------
# フロントエンド配信 (本番環境用)
# -----------------------------------------------------------------------------
# '/api' で始まらない全てのルートリクエストをキャッチする
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_frontend(path):
    """
    本番環境でFlaskサーバーがフロントエンド(React)を配信するためのルート。
    - リクエストされたパスが静的ファイル (例: /assets/index.css) として存在すれば、そのファイルを配信する。
    - それ以外 (例: /, /report, /master) の場合は、React Routerがルーティングを処理できるよう、
      常に 'index.html' を配信する。
    """
    app.logger.info(f"フロントエンド配信リクエスト受信: path='{path}'")
    static_folder_path = app.static_folder

    # 要求されたパスがビルド後の静的ファイルとして存在するかチェック
    if path != "" and os.path.exists(os.path.join(static_folder_path, path)):
        # 存在すればその静的ファイルを配信
        app.logger.info(f"静的ファイル '{path}' を配信します。")
        return send_from_directory(static_folder_path, path)
    else:
        # 存在しない場合 (Reactの仮想ルートなど) は、Reactアプリのエントリーポイントであるindex.htmlを配信
        app.logger.info("Reactアプリの index.html を配信します。")
        return send_from_directory(static_folder_path, 'index.html')

# -----------------------------------------------------------------------------
# スクリプト直接実行
# -----------------------------------------------------------------------------
if __name__ == '__main__':
    # このブロックは `python back_end/app.py` で直接実行された場合にのみ実行される。
    # Flask標準の開発用サーバーを起動する。
    # debug=True はデバッグモードを有効にし、コード変更時に自動リロードする。
    # 本番環境では、GunicornやWaitressなどの本番用WSGIサーバーを使用することが強く推奨される。
    # 例: waitress-serve --host 0.0.0.0 --port 5000 back_end.app:app
    app.run(debug=True, use_reloader=False, port=5000)