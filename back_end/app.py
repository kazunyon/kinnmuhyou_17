import os
import logging
from logging.handlers import RotatingFileHandler
from datetime import datetime
import calendar
from flask import Flask, jsonify, request, g, send_from_directory
from flask_cors import CORS
import sqlite3
import uuid
from functools import wraps
from werkzeug.security import generate_password_hash, check_password_hash

# 外部の勤怠計算モジュールをインポート
from .attendance_calculator import AttendanceCalculator

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
    """アプリケーションのログ出力を設定します。

    'logs' ディレクトリが存在しない場合は作成し、ローテーションするログファイルをセットアップします。
    ログはファイルサイズが10KBを超えるとローテーションされ、最大5つのバックアップが保持されます。
    ログのフォーマットには、タイムスタンプ、ログレベル、メッセージ、ファイルパス、行番号が含まれます。
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
    """リクエストコンテキスト内でデータベース接続を確立し、提供します。

    Flaskの`g`オブジェクトを使用して、同じリクエスト内での接続を再利用します。
    接続が存在しない場合にのみ新しい接続を作成します。
    `sqlite3.Row`をrow_factoryとして設定することで、カラム名でアクセスできる
    辞書のような結果セットを返します。

    Returns:
        sqlite3.Connection: データベース接続オブジェクト。

    Raises:
        sqlite3.Error: データベース接続に失敗した場合。
    """
    if 'db' not in g:
        try:
            g.db = sqlite3.connect(DATABASE)
            g.db.row_factory = sqlite3.Row
            app.logger.info("データベース接続を確立しました。")
        except sqlite3.Error as e:
            app.logger.error(f"データベース接続エラー: {e}")
            raise
    return g.db

@app.teardown_appcontext
def close_db(exception):
    """アプリケーションコンテキストの終了時にデータベース接続をクローズします。

    この関数はFlaskによってリクエストの最後に自動的に呼び出され、
    データベース接続が安全に閉じられることを保証し、接続リークを防ぎます。

    Args:
        exception (Exception, optional): リクエスト処理中に発生した例外。デフォルトはNone。
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
    """在籍中の全社員リストを取得します。

    このエンドポイントは、作業報告書の氏名選択プルダウンで使用されることを想定しています。
    `retirement_flag`が0の社員にフィルタリングされます。
    セキュリティのため、レスポンスからパスワードフィールドは除外されます。

    Returns:
        Response: 社員オブジェクトのリストを含むJSONレスポンス。
                  エラーが発生した場合は、エラーメッセージとステータスコード500を返します。
    """
    try:
        db = get_db()
        cursor = db.execute('SELECT * FROM employees WHERE retirement_flag = 0 ORDER BY employee_id')
        employees = [dict(row) for row in cursor.fetchall()]
        for emp in employees:
            emp.pop('password', None)
        app.logger.info(f"{len(employees)}件の社員データを取得しました。")
        return jsonify(employees)
    except Exception as e:
        app.logger.error(f"社員データ取得エラー: {e}")
        return jsonify({"error": "サーバー内部エラー"}), 500

@app.route('/api/employees/all', methods=['GET'])
def get_all_employees():
    """全社員のリストを取得します（マスターメンテナンス用）。

    このエンドポイントは、マスターメンテナンス画面で全社員のリストを表示するために使用されます。
    セキュリティ上の理由から、パスワード情報はレスポンスに含まれません。

    Returns:
        Response: 社員オブジェクトのリストを含むJSONレスポンス。
                  エラーが発生した場合は、エラーメッセージとステータスコード500を返します。
    """
    try:
        db = get_db()
        cursor = db.execute('SELECT employee_id, company_id, employee_name, department_name, employee_type, retirement_flag FROM employees ORDER BY employee_id')
        employees = [dict(row) for row in cursor.fetchall()]
        app.logger.info(f"全社員データ（マスター用）を{len(employees)}件取得しました。")
        return jsonify(employees)
    except Exception as e:
        app.logger.error(f"全社員データ取得エラー: {e}")
        return jsonify({"error": "サーバー内部エラー"}), 500

@app.route('/api/master/authenticate', methods=['POST'])
def authenticate_master():
    """マスターメンテナンス画面でのユーザー認証を行います。

    提供された社員IDとパスワードを検証します。
    認証が成功した場合、ユーザーがオーナーであるかどうかのフラグを返します。

    Request Body (JSON):
        {
            "employee_id": int,
            "password": str
        }

    Returns:
        Response: 認証結果を含むJSONレスポンス。
                  成功時には { "success": True, "is_owner": bool } を返します。
                  失敗時には適切なエラーメッセージとステータスコードを返します。
    """
    data = request.json
    employee_id = data.get('employee_id')
    password = data.get('password')

    if not employee_id or not password:
        return jsonify({"error": "IDとパスワードは必須です"}), 400

    try:
        db = get_db()
        cursor = db.execute(
            'SELECT password FROM employees WHERE employee_id = ?',
            (employee_id,)
        )
        user = cursor.fetchone()

        if user and user['password'] and check_password_hash(user['password'], password):
            owner_id = get_owner_id()
            is_owner = int(employee_id) == owner_id

            app.logger.info(f"認証成功: 社員ID={employee_id}, オーナー={is_owner}")

            return jsonify({
                "success": True,
                "message": "認証に成功しました",
                "is_owner": is_owner
            }), 200
        else:
            app.logger.warning(f"認証失敗: 社員ID={employee_id}")
            return jsonify({"success": False, "message": "認証情報が正しくありません"}), 401

    except Exception as e:
        app.logger.error(f"認証エラー: {e}")
        return jsonify({"error": "サーバー内部エラー"}), 500

@app.route('/api/companies', methods=['GET'])
def get_companies():
    """会社マスターの全データを取得します。

    Returns:
        Response: 会社オブジェクトのリストを含むJSONレスポンス。
                  例: [{"company_id": 1, "company_name": "株式会社ABC"}, ...]
                  エラーが発生した場合は、エラーメッセージとステータスコード500を返します。
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
    """指定された年の祝日リストをデータベースから取得します。

    Args:
        year (int): 祝日を取得する対象の年。

    Returns:
        Response: 日付をキー、祝日名を値とする辞書形式のJSONレスポンス。
                  例: {"2025-01-01": "元日", "2025-10-13": "スポーツの日"}
                  エラーが発生した場合は、エラーメッセージとステータスコード500を返します。
    """
    try:
        db = get_db()
        cursor = db.execute("SELECT date, holiday_name FROM holidays WHERE strftime('%Y', date) = ?", (str(year),))
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
    """指定された社員と年月の作業記録および月次特記事項を取得します。

    作業報告書画面の初期表示に使用されます。日次記録と月次の特記事項の両方を返します。

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
                  エラーが発生した場合は、エラーメッセージとステータスコード500を返します。
    """
    try:
        db = get_db()
        year_str = str(year)
        month_str = f"{month:02d}"

        records_cursor = db.execute("""
            SELECT CAST(strftime('%d', date) AS INTEGER) as day, start_time, end_time, break_time, work_content
            FROM work_records
            WHERE employee_id = ? AND strftime('%Y', date) = ? AND strftime('%m', date) = ?
        """, (employee_id, year_str, month_str))
        records = [dict(row) for row in records_cursor.fetchall()]

        notes_cursor = db.execute("""
            SELECT special_notes, approval_date FROM monthly_reports
            WHERE employee_id = ? AND year = ? AND month = ?
        """, (employee_id, year, month))
        report_row = notes_cursor.fetchone()

        special_notes = report_row['special_notes'] if report_row else ""
        approval_date = report_row['approval_date'] if report_row else None

        app.logger.info(f"作業記録取得: 社員ID={employee_id}, 年月={year}-{month}, {len(records)}件")
        return jsonify({
            "records": records,
            "special_notes": special_notes,
            "approval_date": approval_date
        })
    except Exception as e:
        app.logger.error(f"作業記録取得エラー: {e}")
        return jsonify({"error": "サーバー内部エラー"}), 500

@app.route('/api/work_records', methods=['POST'])
def save_work_records():
    """作業報告書の日次記録と月次特記事項を保存（UPSERT）します。

    データが存在しない場合は新規作成（INSERT）、存在する場合は更新（UPDATE）します。
    この操作は、リクエスト元の`employee_id`がオーナーIDと一致する場合にのみ許可されます。

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
                  権限がない場合はステータスコード403、
                  データが無効な場合は400、
                  サーバーエラーの場合は500を返します。
    """
    data = request.json
    employee_id = data.get('employee_id')
    year = data.get('year')
    month = data.get('month')
    records = data.get('records')
    special_notes = data.get('special_notes')

    if not all([employee_id, year, month, isinstance(records, list)]):
        app.logger.warning("作業記録保存API: 不正なリクエストデータです。")
        return jsonify({"error": "無効なデータです"}), 400

    owner_id = get_owner_id()
    if employee_id != owner_id:
        app.logger.warning(f"権限のない作業記録保存試行: 操作対象ID={employee_id}, オーナーID={owner_id}")
        return jsonify({"error": "作業記録を更新する権限がありません。"}), 403

    db = get_db()
    try:
        cursor = db.execute(
            "SELECT report_id FROM monthly_reports WHERE employee_id = ? AND year = ? AND month = ?",
            (employee_id, year, month)
        )
        report_row = cursor.fetchone()
        if report_row:
            db.execute(
                "UPDATE monthly_reports SET special_notes = ? WHERE report_id = ?",
                (special_notes, report_row['report_id'])
            )
        else:
            db.execute(
                "INSERT INTO monthly_reports (employee_id, year, month, special_notes) VALUES (?, ?, ?, ?)",
                (employee_id, year, month, special_notes)
            )

        for record in records:
            day = record.get('day')
            if day is None: continue

            date_str = f"{year}-{month:02d}-{day:02d}"
            
            cursor = db.execute(
                "SELECT record_id FROM work_records WHERE employee_id = ? AND date = ?",
                (employee_id, date_str)
            )
            record_row = cursor.fetchone()

            if record_row:
                db.execute("""
                    UPDATE work_records
                    SET start_time = ?, end_time = ?, break_time = ?, work_content = ?
                    WHERE record_id = ?
                """, (
                    record.get('start_time'), record.get('end_time'),
                    record.get('break_time'), record.get('work_content'),
                    record_row['record_id']
                ))
            else:
                db.execute("""
                    INSERT INTO work_records (employee_id, date, start_time, end_time, break_time, work_content)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (
                    employee_id, date_str, record.get('start_time'), record.get('end_time'),
                    record.get('break_time'), record.get('work_content')
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

@app.route('/api/monthly_reports/approve', methods=['POST'])
def approve_monthly_report():
    """月次レポートを承認し、承認日を記録します。

    この操作は、リクエスト元の`employee_id`がオーナーIDと一致する場合にのみ許可されます。
    もし対象の年月に月次レポートが存在しない場合は、このタイミングで新規作成します。

    Request Body (JSON):
        {
            "employee_id": int,
            "year": int,
            "month": int
        }
    """
    data = request.json
    employee_id = data.get('employee_id')
    year = data.get('year')
    month = data.get('month')

    if not all([employee_id, year, month]):
        return jsonify({"error": "無効なデータです"}), 400

    owner_id = get_owner_id()
    if employee_id != owner_id:
        return jsonify({"error": "レポートを承認する権限がありません。"}), 403

    db = get_db()
    try:
        today_str = datetime.now().strftime('%Y-%m-%d')

        cursor = db.execute(
            "SELECT report_id FROM monthly_reports WHERE employee_id = ? AND year = ? AND month = ?",
            (employee_id, year, month)
        )
        report_row = cursor.fetchone()

        if report_row:
            db.execute(
                "UPDATE monthly_reports SET approval_date = ? WHERE report_id = ?",
                (today_str, report_row['report_id'])
            )
        else:
            db.execute(
                "INSERT INTO monthly_reports (employee_id, year, month, approval_date) VALUES (?, ?, ?, ?)",
                (employee_id, year, month, today_str)
            )

        db.commit()
        app.logger.info(f"レポート承認成功: 社員ID={employee_id}, 年月={year}-{month}, 承認日={today_str}")
        return jsonify({"message": "承認しました", "approval_date": today_str}), 200
    except sqlite3.Error as e:
        db.rollback()
        app.logger.error(f"レポート承認エラー (DB): {e}")
        return jsonify({"error": "データベースエラー"}), 500

@app.route('/api/monthly_reports/cancel_approval', methods=['POST'])
def cancel_approval():
    """月次レポートの承認を取り消し、承認日をNULLに設定します。

    この操作は、リクエスト元の`employee_id`がオーナーIDと一致する場合にのみ許可されます。

    Request Body (JSON):
        {
            "employee_id": int,
            "year": int,
            "month": int
        }
    """
    data = request.json
    employee_id = data.get('employee_id')
    year = data.get('year')
    month = data.get('month')

    if not all([employee_id, year, month]):
        return jsonify({"error": "無効なデータです"}), 400

    owner_id = get_owner_id()
    if employee_id != owner_id:
        return jsonify({"error": "承認を取り消す権限がありません。"}), 403

    db = get_db()
    try:
        cursor = db.execute(
            "SELECT report_id FROM monthly_reports WHERE employee_id = ? AND year = ? AND month = ?",
            (employee_id, year, month)
        )
        report_row = cursor.fetchone()

        if report_row:
            db.execute(
                "UPDATE monthly_reports SET approval_date = NULL WHERE report_id = ?",
                (report_row['report_id'],)
            )
            db.commit()
            app.logger.info(f"レポート承認取り消し成功: 社員ID={employee_id}, 年月={year}-{month}")
            return jsonify({"message": "承認を取り消しました", "approval_date": None}), 200
        else:
            # レポート自体が存在しない場合
            app.logger.warning(f"承認取り消し試行: レポートが存在しません。社員ID={employee_id}, 年月={year}-{month}")
            return jsonify({"error": "対象のレポートが見つかりません"}), 404

    except sqlite3.Error as e:
        db.rollback()
        app.logger.error(f"レポート承認取り消しエラー (DB): {e}")
        return jsonify({"error": "データベースエラー"}), 500

# -----------------------------------------------------------------------------
# APIエンドポイント: 勤怠管理表関連
# -----------------------------------------------------------------------------

@app.route('/api/attendance_records/<int:employee_id>/<int:year>/<int:month>', methods=['GET'])
def get_attendance_records(employee_id, year, month):
    """指定された社員と年月の勤怠データを、日次・月次集計と共に取得します。

    勤怠管理表画面の表示に必要な全ての計算済みデータを返します。
    DBから作業記録と祝日を取得し、`AttendanceCalculator`モジュールを
    使用して各日の勤怠サマリーと月次サマリーを計算します。

    Args:
        employee_id (int): 社員ID。
        year (int): 対象年。
        month (int): 対象月。

    Returns:
        Response: 日次記録のリストと月次集計を含むJSONレスポンス。
                  エラーが発生した場合は、エラーメッセージとステータスコード500を返します。
    """
    try:
        db = get_db()
        calculator = AttendanceCalculator()

        cursor = db.execute("""
            SELECT * FROM work_records
            WHERE employee_id = ? AND strftime('%Y', date) = ? AND strftime('%m', date) = ?
        """, (employee_id, f"{year:04d}", f"{month:02d}"))
        records_map = {int(row['date'].split('-')[2]): dict(row) for row in cursor.fetchall()}

        cursor = db.execute("SELECT date FROM holidays WHERE strftime('%Y', date) = ?", (f"{year:04d}",))
        holidays_set = {row['date'] for row in cursor.fetchall()}

        _, num_days = calendar.monthrange(year, month)
        all_daily_data = []

        for day in range(1, num_days + 1):
            date_str = f"{year:04d}-{month:02d}-{day:02d}"
            db_record = records_map.get(day, {})

            weekday = datetime(year, month, day).weekday()
            is_holiday_from_calendar = date_str in holidays_set or weekday in [5, 6]

            calc_input = {
                'start_time': db_record.get('start_time'),
                'end_time': db_record.get('end_time'),
                'break_time': db_record.get('break_time'),
                'night_break_time': db_record.get('night_break_time'),
                'holiday_type': db_record.get('holiday_type'),
                'is_holiday_from_calendar': is_holiday_from_calendar
            }
            daily_summary = calculator.calculate_daily_summary(calc_input)

            daily_data = {
                "day": day,
                "date": date_str,
                "weekday": weekday,
                "holiday_type": db_record.get('holiday_type'),
                "attendance_type": db_record.get('attendance_type'),
                "start_time": db_record.get('start_time'),
                "end_time": db_record.get('end_time'),
                "break_time": db_record.get('break_time'),
                "night_break_time": db_record.get('night_break_time'),
                "remarks": db_record.get('work_content'),
                "daily_summary": daily_summary
            }
            all_daily_data.append(daily_data)

        monthly_summary = calculator.calculate_monthly_summary(all_daily_data)

        app.logger.info(f"勤怠データ取得成功: 社員ID={employee_id}, 年月={year}-{month}")
        return jsonify({
            "daily_records": all_daily_data,
            "monthly_summary": monthly_summary
        })

    except Exception as e:
        app.logger.error(f"勤怠データ取得エラー: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": "サーバー内部エラー"}), 500

@app.route('/api/attendance_records', methods=['POST'])
def save_attendance_records():
    """勤怠管理表からの日次勤怠データを保存（UPSERT）します。

    作業報告書よりも詳細な勤怠情報（勤怠種別、深夜休憩など）を扱います。
    データが存在しない場合は新規作成、存在する場合は更新します。

    Request Body (JSON):
        {
            "employee_id": int,
            "records": [{"date": str, "start_time": str, "holiday_type": int, ...}, ...]
        }

    Returns:
        Response: 保存成功メッセージを含むJSONレスポンス。
                  データが無効な場合は400、サーバーエラーの場合は500を返します。
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
            if not date_str: continue

            cursor = db.execute(
                "SELECT record_id FROM work_records WHERE employee_id = ? AND date = ?",
                (employee_id, date_str)
            )
            record_row = cursor.fetchone()

            # リクエストから送られてきた勤怠種別を取得
            attendance_type = record.get('attendance_type')

            # 全日休みの勤怠種別リスト (2:欠勤, 3:有給, 6:代休, 7:振休)
            full_day_off_types = [2, 3, 6, 7]

            # 勤怠種別が全日休みの場合、時刻関連のデータを強制的に "00:00" にする
            if attendance_type in full_day_off_types:
                start_time = "00:00"
                end_time = "00:00"
                break_time = "00:00"
                night_break_time = "00:00"
            else:
                start_time = record.get('start_time')
                end_time = record.get('end_time')
                break_time = record.get('break_time')
                night_break_time = record.get('night_break_time')

            params = {
                'employee_id': employee_id,
                'date': date_str,
                'holiday_type': record.get('holiday_type'),
                'attendance_type': attendance_type,
                'start_time': start_time,
                'end_time': end_time,
                'break_time': break_time,
                'night_break_time': night_break_time,
                'work_content': record.get('remarks')
            }

            if record_row:
                params['record_id'] = record_row['record_id']
                db.execute("""
                    UPDATE work_records SET
                    holiday_type=:holiday_type, attendance_type=:attendance_type, start_time=:start_time,
                    end_time=:end_time, break_time=:break_time, night_break_time=:night_break_time,
                    work_content=:work_content
                    WHERE record_id=:record_id
                """, params)
            else:
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
    """指定された社員IDと日付の日報データを取得します。

    Args:
        employee_id (int): 社員ID。
        date_str (str): 日付文字列 (YYYY-MM-DD)。

    Returns:
        Response: 日報データオブジェクトを含むJSONレスポンス。
                  データが存在しない場合は`null`を返します。
                  エラーが発生した場合は、エラーメッセージとステータスコード500を返します。
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
            return jsonify(None)
    except Exception as e:
        app.logger.error(f"日報データ取得エラー: {e}")
        return jsonify({"error": "サーバー内部エラー"}), 500

@app.route('/api/daily_report', methods=['POST'])
def save_daily_report():
    """日報データを保存（UPSERT）します。

    データが存在しない場合は新規作成、存在する場合は更新します。
    関連する作業記録（work_records）の作業内容（work_content）も同時に更新し、
    データの一貫性を保証します。

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
                  データが無効な場合は400、サーバーエラーの場合は500を返します。
    """
    data = request.json
    employee_id = data.get('employee_id')
    date = data.get('date')

    if not all([employee_id, date]):
        return jsonify({"error": "無効なデータです"}), 400

    try:
        db = get_db()
        cursor = db.cursor()

        # 1. daily_reports テーブルを更新または挿入
        cursor.execute("SELECT 1 FROM daily_reports WHERE employee_id = ? AND date = ?", (employee_id, date))
        exists = cursor.fetchone()

        if exists:
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
            cursor.execute("""
                INSERT INTO daily_reports 
                (employee_id, date, work_summary, problems, challenges, tomorrow_tasks, thoughts)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                employee_id, date, data.get('work_summary'), data.get('problems'),
                data.get('challenges'), data.get('tomorrow_tasks'), data.get('thoughts')
            ))
        
        # 2. work_records テーブルの work_content も一貫性のために更新または挿入
        work_summary = data.get('work_summary')
        cursor.execute("SELECT record_id FROM work_records WHERE employee_id = ? AND date = ?", (employee_id, date))
        work_record = cursor.fetchone()

        if work_record:
            cursor.execute(
                "UPDATE work_records SET work_content = ? WHERE record_id = ?",
                (work_summary, work_record['record_id'])
            )
        else:
            # work_recordsに該当日のレコードがない場合、日報の作業内容で新規作成
            cursor.execute(
                "INSERT INTO work_records (employee_id, date, work_content) VALUES (?, ?, ?)",
                (employee_id, date, work_summary)
            )

        db.commit()
        app.logger.info(f"日報データ保存成功 (work_recordsも更新): 社員ID={employee_id}, 日付={date}")
        return jsonify({"message": "日報を保存しました"}), 200
    except Exception as e:
        db.rollback()
        app.logger.error(f"日報データ保存エラー: {e}")
        return jsonify({"error": "サーバー内部エラー"}), 500

# -----------------------------------------------------------------------------
# APIエンドポイント: 社員マスターメンテナンス
# -----------------------------------------------------------------------------
def get_owner_id():
    """'num.id'ファイルからオーナーのIDを読み込みます。

    ファイルが存在しない、または内容が不正な場合は、フォールバックとしてID 1を返します。

    Returns:
        int: オーナーの社員ID。
    """
    try:
        num_id_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'num.id')
        with open(num_id_path, 'r') as f:
            owner_id = int(f.read().strip())
            app.logger.info(f"オーナーID ({owner_id}) を num.id から読み込みました。")
            return owner_id
    except (FileNotFoundError, ValueError) as e:
        app.logger.error(f"num.idファイルの読み込みに失敗しました: {e}")
        return 1

@app.route('/api/owner_info', methods=['GET'])
def get_owner_info():
    """オーナーのIDと氏名を取得します。

    Returns:
        Response: オーナーのIDと氏名を含むJSONレスポンス。
                  オーナーが見つからない場合は404エラーを返します。
    """
    try:
        owner_id = get_owner_id()
        db = get_db()
        cursor = db.execute('SELECT employee_name FROM employees WHERE employee_id = ?', (owner_id,))
        owner = cursor.fetchone()
        if owner:
            return jsonify({"owner_id": owner_id, "owner_name": owner['employee_name']})
        else:
            return jsonify({"error": "オーナー情報が見つかりません"}), 404
    except Exception as e:
        app.logger.error(f"オーナー情報取得エラー: {e}")
        return jsonify({"error": "サーバー内部エラー"}), 500

def _get_employee_company_id(employee_id):
    """指定された社員IDが所属する会社のIDを取得します。"""
    try:
        db = get_db()
        cursor = db.execute('SELECT company_id FROM employees WHERE employee_id = ?', (employee_id,))
        employee = cursor.fetchone()
        if employee:
            return employee['company_id']
        return None
    except Exception as e:
        app.logger.error(f"社員の会社ID取得エラー: {e}")
        return None

def is_valid_owner(owner_id, password):
    """提供されたIDとパスワードが正規のオーナーのものであるかを検証します。

    Args:
        owner_id (int): 検証するオーナーのID。
        password (str): 検証するパスワード。

    Returns:
        bool: IDとパスワードが正規のオーナーのものであればTrue、そうでなければFalse。
    """
    try:
        true_owner_id = get_owner_id()
        if int(owner_id) != true_owner_id:
            app.logger.warning(f"オーナー認証失敗: IDの不一致 (要求: {owner_id}, 正: {true_owner_id})")
            return False

        db = get_db()
        cursor = db.execute('SELECT password FROM employees WHERE employee_id = ?', (true_owner_id,))
        owner = cursor.fetchone()

        if owner and owner['password'] and check_password_hash(owner['password'], password):
            app.logger.info("オーナー認証成功")
            return True
        else:
            app.logger.warning("オーナー認証失敗: パスワードの不一致")
            return False
    except Exception as e:
        app.logger.error(f"オーナー認証中に例外発生: {e}")
        return False

@app.route('/api/employee', methods=['POST'])
def add_employee():
    """新しい社員を追加します（マスターメンテナンス用）。

    この操作は、リクエストに含まれる認証情報が正規のオーナーのものである
    場合にのみ許可されます。
    """
    data = request.json
    owner_id = data.get('owner_id')
    owner_password = data.get('owner_password')
    target_company_id = data.get('company_id')

    if not is_valid_owner(owner_id, owner_password):
        return jsonify({"error": "この操作を行う権限がありません"}), 403

    owner_company_id = _get_employee_company_id(owner_id)
    if not owner_company_id or owner_company_id != target_company_id:
        app.logger.warning(f"権限のない社員追加試行: オーナー(会社ID:{owner_company_id})が別会社(ID:{target_company_id})の社員を追加しようとしました。")
        return jsonify({"error": "自分の会社以外の社員は追加できません"}), 403

    try:
        db = get_db()
        cursor = db.cursor()

        password_hash = generate_password_hash('123')

        cursor.execute("""
            INSERT INTO employees (company_id, employee_name, department_name, employee_type, retirement_flag, password)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            target_company_id,
            data.get('employee_name'),
            data.get('department_name'),
            data.get('employee_type'),
            1 if data.get('retirement_flag') else 0,
            password_hash
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
    """既存の社員情報を更新します（マスターメンテナンス用）。

    この操作は、正規のオーナーであり、かつオーナー自身の会社の社員情報を
    更新する場合にのみ許可されます。
    """
    data = request.json
    owner_id = data.get('owner_id')
    owner_password = data.get('owner_password')

    if not is_valid_owner(owner_id, owner_password):
        return jsonify({"error": "この操作を行う権限がありません"}), 403

    # オーナーは自身の会社の従業員情報を更新できる
    owner_company_id = _get_employee_company_id(owner_id)
    target_company_id = _get_employee_company_id(employee_id)
    if not owner_company_id or owner_company_id != target_company_id:
        app.logger.warning(f"権限のない更新試行: オーナー(会社ID:{owner_company_id})が別会社(ID:{target_company_id})の社員(ID:{employee_id})を更新しようとしました。")
        return jsonify({"error": "自分の会社の社員情報のみ更新できます"}), 403

    try:
        db = get_db()
        db.execute("""
            UPDATE employees SET
            employee_name = ?, department_name = ?, employee_type = ?,
            retirement_flag = ?
            WHERE employee_id = ?
        """, (
            data.get('employee_name'),
            data.get('department_name'),
            data.get('employee_type'),
            1 if data.get('retirement_flag') else 0,
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
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_frontend(path):
    """本番環境でフロントエンドの静的ファイルまたはindex.htmlを配信します。

    リクエストされたパスが`static_folder`内に物理的なファイルとして存在する場合、
    そのファイルを配信します。これは、CSS、JavaScriptバンドル、画像などのアセットに
    対応します。

    パスがファイルとして存在しない場合、Reactアプリケーションのエントリーポイントである
    `index.html`を配信します。これにより、React Routerのようなクライアントサイドの
    ルーティングが正しく機能します。

    Args:
        path (str): リクエストされたパス。

    Returns:
        Response: 静的ファイルまたはindex.htmlの内容。
    """
    app.logger.info(f"フロントエンド配信リクエスト受信: path='{path}'")
    static_folder_path = app.static_folder

    if path != "" and os.path.exists(os.path.join(static_folder_path, path)):
        app.logger.info(f"静的ファイル '{path}' を配信します。")
        return send_from_directory(static_folder_path, path)
    else:
        app.logger.info("Reactアプリの index.html を配信します。")
        return send_from_directory(static_folder_path, 'index.html')

# -----------------------------------------------------------------------------
# スクリプト直接実行
# -----------------------------------------------------------------------------
if __name__ == '__main__':
    # このスクリプトが直接実行された場合にFlaskの開発サーバーを起動します。
    # `python back_end/app.py` で実行します。
    #
    # debug=True: デバッグモードを有効にし、コード変更時にサーバーを自動リロードします。
    # use_reloader=False: デバッグモードでのリローダーの重複を防ぎます。
    # port=5000: サーバーがリッスンするポートを指定します。
    #
    # 注意: この開発サーバーは本番環境での使用には適していません。
    # 本番環境ではGunicornやWaitressのようなWSGIサーバーを使用してください。
    app.run(debug=True, use_reloader=False, port=5000)
