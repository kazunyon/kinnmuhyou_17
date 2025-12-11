import os
import logging
from logging.handlers import RotatingFileHandler
from datetime import datetime
import calendar
import math
from flask import Flask, jsonify, request, g, send_from_directory, session
from flask_cors import CORS
import sqlite3
import uuid
from functools import wraps
from werkzeug.security import generate_password_hash, check_password_hash

# 外部の勤怠計算モジュールをインポート
from attendance_calculator import AttendanceCalculator

# -----------------------------------------------------------------------------
# アプリケーション設定
# -----------------------------------------------------------------------------
app = Flask(__name__, static_folder='../front_end/dist')
CORS(app, supports_credentials=True) # クッキーを含むリクエストを許可

# セッション用のシークレットキー (本番環境では環境変数などから読み込むべき)
app.secret_key = os.environ.get('SECRET_KEY', 'dev_secret_key_change_in_production')

DATABASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'database.db')

# -----------------------------------------------------------------------------
# ロギング設定
# -----------------------------------------------------------------------------
def setup_logging():
    """アプリケーションのロギングを設定します。

    'logs'ディレクトリを作成し、日付ごとのログファイルにログを出力するように設定します。
    ログのフォーマットは '%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]' です。
    """
    if not os.path.exists('logs'):
        os.mkdir('logs')
    log_file_name = f"logs/app_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
    handler = RotatingFileHandler(log_file_name, maxBytes=10000, backupCount=5, encoding='utf-8')
    handler.setFormatter(logging.Formatter(
        '%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'
    ))
    app.logger.setLevel(logging.INFO)
    app.logger.addHandler(handler)
    app.logger.info('アプリケーション起動ログ')

setup_logging()

# -----------------------------------------------------------------------------
# データベース接続管理
# -----------------------------------------------------------------------------
def get_db():
    """データベース接続を取得します。

    Flaskのグローバルコンテキスト `g` にデータベース接続を保存し、再利用します。
    接続が確立されていない場合は、新たに接続を作成します。

    Returns:
        sqlite3.Connection: データベース接続オブジェクト。

    Raises:
        sqlite3.Error: データベース接続中にエラーが発生した場合。
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
    """リクエスト終了時にデータベース接続をクローズします。

    Args:
        exception (Exception): 発生した例外（ある場合）。
    """
    db = g.pop('db', None)
    if db is not None:
        db.close()
        app.logger.info("データベース接続をクローズしました。")

# -----------------------------------------------------------------------------
# 認証・認可デコレータ
# -----------------------------------------------------------------------------
def login_required(f):
    """ログインが必要なエンドポイントのためのデコレータ。

    セッションに `user_id` が存在しない場合、401エラーを返します。

    Args:
        f (function): デコレート対象の関数。

    Returns:
        function: ラップされた関数。
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({"error": "ログインが必要です"}), 401
        return f(*args, **kwargs)
    return decorated_function

# -----------------------------------------------------------------------------
# APIエンドポイント: 認証関連
# -----------------------------------------------------------------------------

@app.route('/api/login', methods=['POST'])
def login():
    """ログイン認証を行い、セッションを開始します。

    リクエストボディから `employee_id` と `password` を取得し、
    データベースと照合します。成功した場合、セッション情報を設定します。

    Returns:
        Response: JSON形式のレスポンス。成功時はユーザー情報、失敗時はエラーメッセージ。
    """
    data = request.json
    employee_id = data.get('employee_id')
    password = data.get('password')

    if not employee_id or not password:
        return jsonify({"error": "IDとパスワードは必須です"}), 400

    try:
        db = get_db()
        cursor = db.execute('SELECT * FROM employees WHERE employee_id = ?', (employee_id,))
        user = cursor.fetchone()

        if user and user['password'] and check_password_hash(user['password'], password):
            session.clear()
            session['user_id'] = user['employee_id']
            session['role'] = user['role']
            session['employee_name'] = user['employee_name']

            app.logger.info(f"ログイン成功: ID={employee_id}, Role={user['role']}")
            return jsonify({
                "success": True,
                "user": {
                    "employee_id": user['employee_id'],
                    "employee_name": user['employee_name'],
                    "role": user['role'],
                    "company_id": user['company_id'],
                    "department_name": user['department_name']
                }
            })
        else:
            app.logger.warning(f"ログイン失敗: ID={employee_id}")
            return jsonify({"error": "IDまたはパスワードが正しくありません"}), 401
    except Exception as e:
        app.logger.error(f"ログインエラー: {e}")
        return jsonify({"error": "サーバー内部エラー"}), 500

@app.route('/api/change_password', methods=['POST'])
def change_password():
    """パスワード変更を行います。

    現在のパスワードを確認後、新しいパスワードをハッシュ化して保存します。

    Returns:
        Response: JSON形式のレスポンス。
    """
    data = request.json
    employee_id = data.get('employee_id')
    current_password = data.get('current_password')
    new_password = data.get('new_password')

    if not employee_id or not current_password or not new_password:
        return jsonify({"error": "全ての項目を入力してください"}), 400

    try:
        db = get_db()
        cursor = db.execute('SELECT password FROM employees WHERE employee_id = ?', (employee_id,))
        user = cursor.fetchone()

        if user and user['password'] and check_password_hash(user['password'], current_password):
            new_password_hash = generate_password_hash(new_password)
            db.execute('UPDATE employees SET password = ? WHERE employee_id = ?', (new_password_hash, employee_id))
            db.commit()
            app.logger.info(f"パスワード変更成功: ID={employee_id}")
            return jsonify({"success": True, "message": "パスワードを変更しました"}), 200
        else:
            app.logger.warning(f"パスワード変更失敗: ID={employee_id} (パスワード不一致)")
            return jsonify({"error": "現在のパスワードが正しくありません"}), 401
    except Exception as e:
        app.logger.error(f"パスワード変更エラー: {e}")
        db.rollback()
        return jsonify({"error": "サーバー内部エラー"}), 500

@app.route('/api/logout', methods=['POST'])
def logout():
    """ログアウト処理を行います。

    セッションをクリアします。

    Returns:
        Response: JSON形式のレスポンス。
    """
    session.clear()
    return jsonify({"message": "ログアウトしました"}), 200

@app.route('/api/me', methods=['GET'])
def get_current_user():
    """現在のログインユーザー情報を返します。

    セッションから現在のユーザーID、役割、名前を取得して返します。

    Returns:
        Response: JSON形式のユーザー情報。ログインしていない場合はNone。
    """
    if 'user_id' not in session:
        return jsonify(None)
    return jsonify({
        "employee_id": session['user_id'],
        "role": session['role'],
        "employee_name": session['employee_name']
    })

# -----------------------------------------------------------------------------
# APIエンドポイント: マスターデータ関連
# -----------------------------------------------------------------------------

@app.route('/api/employees', methods=['GET'])
@login_required
def get_employees():
    """退職していない社員の一覧を取得します。

    パスワードフィールドは除外されます。

    Returns:
        Response: 社員情報のリストを含むJSONレスポンス。
    """
    try:
        db = get_db()
        cursor = db.execute('SELECT * FROM employees WHERE retirement_flag = 0 ORDER BY employee_id')
        employees = [dict(row) for row in cursor.fetchall()]
        for emp in employees:
            emp.pop('password', None)
        return jsonify(employees)
    except Exception as e:
        app.logger.error(f"社員データ取得エラー: {e}")
        return jsonify({"error": "サーバー内部エラー"}), 500

@app.route('/api/employees/all', methods=['GET'])
@login_required
def get_all_employees():
    """全社員の一覧を取得します（管理者・経理担当者向け）。

    退職済みの社員も含め、全ての社員情報を返します。

    Returns:
        Response: 全社員情報のリストを含むJSONレスポンス。
    """
    # 権限チェック: 部長または経理のみ
    if session.get('role') not in ['manager', 'accounting']:
        return jsonify({"error": "権限がありません"}), 403

    try:
        db = get_db()
        cursor = db.execute('SELECT employee_id, company_id, employee_name, department_name, employee_type, role, retirement_flag FROM employees ORDER BY employee_id')
        employees = [dict(row) for row in cursor.fetchall()]
        return jsonify(employees)
    except Exception as e:
        app.logger.error(f"全社員データ取得エラー: {e}")
        return jsonify({"error": "サーバー内部エラー"}), 500

@app.route('/api/master/authenticate', methods=['POST'])
@login_required
def authenticate_master():
    """マスターメンテナンス権限チェックを行います。

    ログイン中のユーザーが管理者または経理担当者であるかを確認します。

    Returns:
        Response: 認証結果を含むJSONレスポンス。
    """
    # 既存の実装はパスワードを再送させているが、ログイン済みであればセッションから権限を確認する形が良い。
    # ここでは既存のフローを尊重しつつ、roleチェックを加える。
    data = request.json
    employee_id = data.get('employee_id')
    password = data.get('password') # 既存フローではパスワード再入力がある

    # ロールチェック
    if session.get('role') not in ['manager', 'accounting']:
         return jsonify({"success": False, "message": "権限がありません"}), 403

    # パスワード確認 (もし送られてくるなら)
    if password:
        try:
            db = get_db()
            cursor = db.execute('SELECT password FROM employees WHERE employee_id = ?', (employee_id,))
            user = cursor.fetchone()
            if user and check_password_hash(user['password'], password):
                return jsonify({"success": True, "message": "認証成功", "is_owner": True}), 200
            else:
                return jsonify({"success": False, "message": "パスワードが違います"}), 401
        except Exception:
            return jsonify({"error": "エラー"}), 500

    # パスワードなしでセッションだけでOKとする場合 (UI側次第)
    return jsonify({"success": True, "message": "認証成功", "is_owner": True}), 200


@app.route('/api/companies', methods=['GET'])
def get_companies():
    """会社情報の一覧を取得します。

    Returns:
        Response: 会社情報のリストを含むJSONレスポンス。
    """
    # ログイン画面でも使うかもしれないので認証なしでもOKとする、あるいは認証必須にする
    try:
        db = get_db()
        cursor = db.execute('SELECT * FROM companies')
        companies = [dict(row) for row in cursor.fetchall()]
        return jsonify(companies)
    except Exception as e:
        return jsonify({"error": "サーバー内部エラー"}), 500

@app.route('/api/holidays/<int:year>', methods=['GET'])
@login_required
def get_holidays(year):
    """指定された年の祝日データを取得します。

    Args:
        year (int): 取得対象の年。

    Returns:
        Response: 日付をキー、祝日名を値とする辞書のJSONレスポンス。
    """
    try:
        db = get_db()
        cursor = db.execute("SELECT date, holiday_name FROM holidays WHERE strftime('%Y', date) = ?", (str(year),))
        holidays = {row['date']: row['holiday_name'] for row in cursor.fetchall()}
        return jsonify(holidays)
    except Exception as e:
        return jsonify({"error": "サーバー内部エラー"}), 500

# -----------------------------------------------------------------------------
# APIエンドポイント: 取引先・案件マスター関連 (省略せず実装)
# -----------------------------------------------------------------------------
# ... (既存のコードと同じだが @login_required を追加)

@app.route('/api/clients', methods=['GET'])
@login_required
def get_clients():
    """取引先一覧を取得します。

    クエリパラメータ `include_deleted=true` を指定すると、削除済み取引先も含めます。

    Returns:
        Response: 取引先情報のリストを含むJSONレスポンス。
    """
    include_deleted = request.args.get('include_deleted') == 'true'
    try:
        db = get_db()
        if include_deleted:
            cursor = db.execute('SELECT * FROM clients ORDER BY client_id')
        else:
            cursor = db.execute('SELECT * FROM clients WHERE deleted = 0 OR deleted IS NULL ORDER BY client_id')
        clients = [dict(row) for row in cursor.fetchall()]
        return jsonify(clients)
    except Exception as e:
        return jsonify({"error": "サーバー内部エラー"}), 500

@app.route('/api/clients', methods=['POST'])
@login_required
def add_client():
    """新しい取引先を追加します。

    管理者または経理担当者のみ実行可能です。

    Returns:
        Response: 作成された取引先のIDを含むJSONレスポンス。
    """
    if session.get('role') not in ['manager', 'accounting']:
        return jsonify({"error": "権限がありません"}), 403
    data = request.json
    client_name = data.get('client_name')
    if not client_name: return jsonify({"error": "必須"}), 400
    try:
        db = get_db()
        cursor = db.execute('INSERT INTO clients (client_name) VALUES (?)', (client_name,))
        db.commit()
        return jsonify({"message": "追加しました", "client_id": cursor.lastrowid}), 201
    except Exception:
        db.rollback()
        return jsonify({"error": "エラー"}), 500

@app.route('/api/clients/<int:client_id>', methods=['PUT'])
@login_required
def update_client(client_id):
    """取引先情報を更新します。

    Args:
        client_id (int): 更新対象の取引先ID。

    Returns:
        Response: 更新結果を含むJSONレスポンス。
    """
    if session.get('role') not in ['manager', 'accounting']:
        return jsonify({"error": "権限がありません"}), 403
    # ... (既存ロジック)
    data = request.json
    client_name = data.get('client_name')
    deleted = data.get('deleted_flag', 0)
    try:
        db = get_db()
        db.execute('UPDATE clients SET client_name = ?, deleted = ? WHERE client_id = ?', (client_name, deleted, client_id))
        db.commit()
        return jsonify({"message": "更新しました"}), 200
    except Exception:
        db.rollback()
        return jsonify({"error": "エラー"}), 500

@app.route('/api/clients/<int:client_id>', methods=['DELETE'])
@login_required
def delete_client(client_id):
    """取引先を削除（論理削除）します。

    Args:
        client_id (int): 削除対象の取引先ID。

    Returns:
        Response: 削除結果を含むJSONレスポンス。
    """
    if session.get('role') not in ['manager', 'accounting']:
        return jsonify({"error": "権限がありません"}), 403
    try:
        db = get_db()
        db.execute('UPDATE clients SET deleted = 1 WHERE client_id = ?', (client_id,))
        db.commit()
        return jsonify({"message": "削除しました"}), 200
    except Exception:
        db.rollback()
        return jsonify({"error": "エラー"}), 500

@app.route('/api/projects', methods=['GET'])
@login_required
def get_projects():
    """案件一覧を取得します。

    Returns:
        Response: 案件情報のリストを含むJSONレスポンス。
    """
    include_deleted = request.args.get('include_deleted') == 'true'
    try:
        db = get_db()
        query = 'SELECT p.*, c.client_name FROM projects p JOIN clients c ON p.client_id = c.client_id'
        if not include_deleted:
            query += ' WHERE (p.deleted = 0 OR p.deleted IS NULL) AND (c.deleted = 0 OR c.deleted IS NULL)'
        query += ' ORDER BY p.project_id'
        cursor = db.execute(query)
        projects = [dict(row) for row in cursor.fetchall()]
        return jsonify(projects)
    except Exception:
        return jsonify({"error": "エラー"}), 500

@app.route('/api/projects', methods=['POST'])
@login_required
def add_project():
    """新しい案件を追加します。

    Returns:
        Response: 作成された案件のIDを含むJSONレスポンス。
    """
    if session.get('role') not in ['manager', 'accounting']:
        return jsonify({"error": "権限がありません"}), 403
    data = request.json
    # ...
    try:
        db = get_db()
        cursor = db.execute('INSERT INTO projects (client_id, project_name) VALUES (?, ?)', (data.get('client_id'), data.get('project_name')))
        db.commit()
        return jsonify({"message": "追加しました", "project_id": cursor.lastrowid}), 201
    except Exception:
        db.rollback()
        return jsonify({"error": "エラー"}), 500

@app.route('/api/projects/<int:project_id>', methods=['PUT'])
@login_required
def update_project(project_id):
    """案件情報を更新します。

    Args:
        project_id (int): 更新対象の案件ID。

    Returns:
        Response: 更新結果を含むJSONレスポンス。
    """
    if session.get('role') not in ['manager', 'accounting']:
        return jsonify({"error": "権限がありません"}), 403
    data = request.json
    # ...
    try:
        db = get_db()
        db.execute('UPDATE projects SET client_id = ?, project_name = ?, deleted = ? WHERE project_id = ?',
                   (data.get('client_id'), data.get('project_name'), data.get('deleted_flag', 0), project_id))
        db.commit()
        return jsonify({"message": "更新しました"}), 200
    except Exception:
        db.rollback()
        return jsonify({"error": "エラー"}), 500

@app.route('/api/projects/<int:project_id>', methods=['DELETE'])
@login_required
def delete_project(project_id):
    """案件を削除（論理削除）します。

    Args:
        project_id (int): 削除対象の案件ID。

    Returns:
        Response: 削除結果を含むJSONレスポンス。
    """
    if session.get('role') not in ['manager', 'accounting']:
        return jsonify({"error": "権限がありません"}), 403
    try:
        db = get_db()
        db.execute('UPDATE projects SET deleted = 1 WHERE project_id = ?', (project_id,))
        db.commit()
        return jsonify({"message": "削除しました"}), 200
    except Exception:
        db.rollback()
        return jsonify({"error": "エラー"}), 500

# -----------------------------------------------------------------------------
# APIエンドポイント: 作業報告書関連
# -----------------------------------------------------------------------------

@app.route('/api/work_records/<int:employee_id>/<int:year>/<int:month>', methods=['GET'])
@login_required
def get_work_records(employee_id, year, month):
    """指定された従業員、年、月の作業記録と月次集計を取得します。

    AttendanceCalculator を使用して、日次の勤務時間や残業時間、および月次の集計を計算します。
    プロジェクトごとの作業時間割合も計算します。

    Args:
        employee_id (int): 従業員ID。
        year (int): 年。
        month (int): 月。

    Returns:
        Response: 作業記録、プロジェクト集計、月次レポート情報を含むJSONレスポンス。
    """
    # 権限チェック
    current_user_id = session.get('user_id')
    current_role = session.get('role')

    if current_user_id != employee_id and current_role not in ['manager', 'accounting']:
        return jsonify({"error": "他のユーザーのデータを閲覧する権限がありません"}), 403

    try:
        db = get_db()
        calculator = AttendanceCalculator()
        year_str = str(year)
        month_str = f"{month:02d}"

        records_cursor = db.execute("""
            SELECT *, CAST(strftime('%d', date) AS INTEGER) as day
            FROM work_records
            WHERE employee_id = ? AND strftime('%Y', date) = ? AND strftime('%m', date) = ?
        """, (employee_id, year_str, month_str))
        records_for_display = [dict(row) for row in records_cursor.fetchall()]

        for record in records_for_display:
            details_cursor = db.execute("""
                SELECT d.*, c.client_name, p.project_name
                FROM work_record_details d
                JOIN clients c ON d.client_id = c.client_id
                JOIN projects p ON d.project_id = p.project_id
                WHERE d.record_id = ?
            """, (record['record_id'],))
            record['details'] = [dict(row) for row in details_cursor.fetchall()]

        records_map = {r['day']: r for r in records_for_display}
        holidays_cursor = db.execute("SELECT date FROM holidays WHERE strftime('%Y', date) = ?", (year_str,))
        holidays_set = {row['date'] for row in holidays_cursor.fetchall()}

        _, num_days = calendar.monthrange(year, month)
        all_daily_data_for_summary = []
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
            summary_input_record = {
                "attendance_type": db_record.get('attendance_type'),
                "daily_summary": daily_summary
            }
            all_daily_data_for_summary.append(summary_input_record)

        monthly_summary = calculator.calculate_monthly_summary(all_daily_data_for_summary)

        # プロジェクト集計 (既存ロジック)
        project_summary_map = {}
        project_raw_summary_map = {}  # B時間集計用
        for record in records_for_display:
             if 'details' in record and record['details']:
                details_total_minutes = sum(d.get('work_time', 0) for d in record['details'])
                start_time = record.get('start_time')
                end_time = record.get('end_time')
                break_time = record.get('break_time')
                work_records_minutes = 0
                if start_time and end_time:
                    try:
                        start_minutes = int(start_time.split(':')[0]) * 60 + int(start_time.split(':')[1])
                        end_minutes = int(end_time.split(':')[0]) * 60 + int(end_time.split(':')[1])
                        break_minutes = 0
                        if break_time:
                            break_minutes = int(break_time.split(':')[0]) * 60 + int(break_time.split(':')[1])
                        work_records_minutes = max(0, end_minutes - start_minutes - break_minutes)
                    except (ValueError, IndexError):
                        pass
                ratio = 1.0
                if details_total_minutes > 0:
                    ratio = work_records_minutes / float(details_total_minutes)
                elif len(record['details']) > 0:
                     for detail in record['details']:
                        key = (detail['client_name'], detail['project_name'])
                        if key not in project_summary_map: project_summary_map[key] = 0.0
                        project_summary_map[key] += float(work_records_minutes) / len(record['details'])

                        # raw mapにも0で初期化しておく(念のため)
                        if key not in project_raw_summary_map: project_raw_summary_map[key] = 0
                     continue

                for detail in record['details']:
                    key = (detail['client_name'], detail['project_name'])
                    if key not in project_summary_map: project_summary_map[key] = 0.0
                    project_summary_map[key] += detail.get('work_time', 0) * ratio

                    # B時間の集計 (単純合計)
                    if key not in project_raw_summary_map: project_raw_summary_map[key] = 0
                    project_raw_summary_map[key] += detail.get('work_time', 0)

        project_summary = []
        for (client_name, project_name), total_minutes in project_summary_map.items():
            hours = total_minutes / 60.0
            truncated_hours = math.floor(hours * 100) / 100.0

            raw_minutes = project_raw_summary_map.get((client_name, project_name), 0)
            raw_hours = raw_minutes / 60.0
            truncated_raw_hours = math.floor(raw_hours * 100) / 100.0

            project_summary.append({
                "client_name": client_name,
                "project_name": project_name,
                "total_hours": f"{truncated_hours:.2f}",
                "total_minutes": round(total_minutes),
                "total_raw_hours": f"{truncated_raw_hours:.2f}",
                "total_raw_minutes": raw_minutes
            })
        # 取引先名 > 案件名 の順で昇順ソート
        project_summary.sort(key=lambda x: (str(x['client_name']), str(x['project_name'])))

        # 月次レポート情報取得 (新しいカラムを含む)
        report_cursor = db.execute("""
            SELECT * FROM monthly_reports
            WHERE employee_id = ? AND year = ? AND month = ?
        """, (employee_id, year, month))
        report_row = report_cursor.fetchone()

        special_notes = ""
        approval_date = None # 古いapproval_date互換
        status = "draft"
        submitted_date = None
        manager_approval_date = None
        accounting_approval_date = None
        remand_reason = None

        manual_summary_fields = {
            'absent_days': 0, 'paid_holidays': 0, 'compensatory_holidays': 0,
            'substitute_holidays': 0, 'late_days': 0, 'early_leave_days': 0, 'holiday_work_days': 0
        }

        if report_row:
            special_notes = report_row['special_notes'] or ""
            approval_date = report_row['approval_date']
            status = report_row['status']
            submitted_date = report_row['submitted_date']
            manager_approval_date = report_row['manager_approval_date']
            accounting_approval_date = report_row['accounting_approval_date']
            remand_reason = report_row['remand_reason']

            for field in manual_summary_fields.keys():
                if report_row[field] is not None:
                    manual_summary_fields[field] = report_row[field]

        monthly_summary.update(manual_summary_fields)

        return jsonify({
            "records": records_for_display,
            "project_summary": project_summary,
            "special_notes": special_notes,
            "approval_date": approval_date,
            "status": status,
            "submitted_date": submitted_date,
            "manager_approval_date": manager_approval_date,
            "accounting_approval_date": accounting_approval_date,
            "remand_reason": remand_reason,
            "monthly_summary": monthly_summary
        })
    except Exception as e:
        app.logger.error(f"作業記録取得エラー: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": "サーバー内部エラー"}), 500

@app.route('/api/work_records', methods=['POST'])
@login_required
def save_work_records():
    """作業記録を保存します。

    日次の作業記録と、月次のレポート情報（特記事項など）を一括で保存します。
    レポートのステータスが 'draft' または 'remanded' の場合のみ保存可能です。

    Returns:
        Response: 保存結果を含むJSONレスポンス。
    """
    data = request.json
    employee_id = data.get('employee_id')
    year = data.get('year')
    month = data.get('month')
    records = data.get('records')
    special_notes = data.get('special_notes')
    monthly_summary = data.get('monthly_summary', {})

    current_user_id = session.get('user_id')
    current_role = session.get('role')

    # 基本的に本人のみ
    if current_user_id != employee_id:
        # 例外: 権限によっては編集できるかもしれないが、仕様では「本人限定の書き込み制限」
        return jsonify({"error": "自分以外のデータは編集できません"}), 403

    db = get_db()

    # ステータスチェック: draft または remanded の場合のみ編集可能
    cursor = db.execute(
        "SELECT status FROM monthly_reports WHERE employee_id = ? AND year = ? AND month = ?",
        (employee_id, year, month)
    )
    report = cursor.fetchone()
    if report:
        current_status = report['status']
        if current_status not in ['draft', 'remanded']:
             return jsonify({"error": f"現在のステータス({current_status})では編集できません"}), 403

    try:
        # 1. 月次レポート（特記事項と月次集計）をUPSERT
        # ステータスがない場合は 'draft' で作成される (schema default)

        # ... (既存のUPSERTロジックだが status は触らない)
        report_cursor = db.execute(
            "SELECT report_id FROM monthly_reports WHERE employee_id = ? AND year = ? AND month = ?",
            (employee_id, year, month)
        )
        report_row = report_cursor.fetchone()

        report_params = {
            "employee_id": employee_id,
            "year": year,
            "month": month,
            "special_notes": special_notes,
            "absent_days": monthly_summary.get('absent_days'),
            "paid_holidays": monthly_summary.get('paid_holidays'),
            "compensatory_holidays": monthly_summary.get('compensatory_holidays'),
            "substitute_holidays": monthly_summary.get('substitute_holidays'),
            "late_days": monthly_summary.get('late_days'),
            "early_leave_days": monthly_summary.get('early_leave_days'),
            "holiday_work_days": monthly_summary.get('holiday_work_days')
        }

        if report_row:
            report_params["report_id"] = report_row['report_id']
            db.execute("""
                UPDATE monthly_reports SET
                special_notes = :special_notes, absent_days = :absent_days, paid_holidays = :paid_holidays,
                compensatory_holidays = :compensatory_holidays, substitute_holidays = :substitute_holidays,
                late_days = :late_days, early_leave_days = :early_leave_days, holiday_work_days = :holiday_work_days
                WHERE report_id = :report_id
            """, report_params)
        else:
            db.execute("""
                INSERT INTO monthly_reports (
                    employee_id, year, month, special_notes, absent_days, paid_holidays,
                    compensatory_holidays, substitute_holidays, late_days, early_leave_days, holiday_work_days,
                    status
                ) VALUES (
                    :employee_id, :year, :month, :special_notes, :absent_days, :paid_holidays,
                    :compensatory_holidays, :substitute_holidays, :late_days, :early_leave_days, :holiday_work_days,
                    'draft'
                )
            """, report_params)

        # 2. 日次作業記録をループでUPSERT
        for record in records:
            day = record.get('day')
            if day is None: continue

            date_str = f"{year}-{month:02d}-{day:02d}"
            
            cursor = db.execute(
                "SELECT record_id FROM work_records WHERE employee_id = ? AND date = ?",
                (employee_id, date_str)
            )
            record_row = cursor.fetchone()

            details = record.get('details', [])

            record_id = None
            if record_row:
                record_id = record_row['record_id']
                db.execute("""
                    UPDATE work_records
                    SET start_time = ?, end_time = ?, break_time = ?, work_content = ?
                    WHERE record_id = ?
                """, (
                    record.get('start_time'), record.get('end_time'),
                    record.get('break_time'), record.get('work_content'),
                    record_id
                ))
            else:
                cursor = db.execute("""
                    INSERT INTO work_records (employee_id, date, start_time, end_time, break_time, work_content)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (
                    employee_id, date_str, record.get('start_time'), record.get('end_time'),
                    record.get('break_time'), record.get('work_content')
                ))
                record_id = cursor.lastrowid

            if details is not None:
                db.execute("DELETE FROM work_record_details WHERE record_id = ?", (record_id,))
                for detail in details:
                    client_id = detail.get('client_id')
                    project_id = detail.get('project_id')
                    work_time = detail.get('work_time')
                    if client_id and project_id and work_time is not None:
                        db.execute("""
                            INSERT INTO work_record_details (record_id, client_id, project_id, work_time)
                            VALUES (?, ?, ?, ?)
                        """, (record_id, client_id, project_id, work_time))

        db.commit()
        return jsonify({"message": "保存しました"}), 200
    except Exception as e:
        db.rollback()
        app.logger.error(f"作業記録保存エラー: {e}")
        return jsonify({"error": "サーバー内部エラー"}), 500

@app.route('/api/monthly_reports/submit', methods=['POST'])
@login_required
def submit_monthly_report():
    """月次レポートを提出します。

    ステータスを 'submitted' に更新します。本人以外は提出できません。

    Returns:
        Response: 提出結果を含むJSONレスポンス。
    """
    data = request.json
    employee_id = data.get('employee_id')
    year = data.get('year')
    month = data.get('month')

    current_user_id = session.get('user_id')
    if current_user_id != employee_id:
        return jsonify({"error": "本人以外提出できません"}), 403

    db = get_db()
    try:
        today_str = datetime.now().strftime('%Y-%m-%d')
        cursor = db.execute("SELECT status FROM monthly_reports WHERE employee_id=? AND year=? AND month=?", (employee_id, year, month))
        row = cursor.fetchone()
        if not row:
             return jsonify({"error": "レポートが存在しません。先に保存してください。"}), 404

        if row['status'] not in ['draft', 'remanded']:
            return jsonify({"error": "提出できるステータスではありません"}), 400

        db.execute("""
            UPDATE monthly_reports
            SET status = 'submitted', submitted_date = ?
            WHERE employee_id = ? AND year = ? AND month = ?
        """, (today_str, employee_id, year, month))
        db.commit()
        return jsonify({"message": "提出しました", "status": "submitted", "submitted_date": today_str}), 200
    except Exception as e:
        db.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/monthly_reports/approve', methods=['POST'])
@login_required
def approve_monthly_report():
    """月次レポートを承認します（部長向け）。

    ステータスを 'approved' に更新します。部長権限が必要です。

    Returns:
        Response: 承認結果を含むJSONレスポンス。
    """
    data = request.json
    employee_id = data.get('employee_id')
    year = data.get('year')
    month = data.get('month')

    if session.get('role') != 'manager':
        return jsonify({"error": "部長権限が必要です"}), 403

    db = get_db()
    try:
        today_str = datetime.now().strftime('%Y-%m-%d')
        cursor = db.execute("SELECT status FROM monthly_reports WHERE employee_id=? AND year=? AND month=?", (employee_id, year, month))
        row = cursor.fetchone()

        if not row or row['status'] != 'submitted':
             return jsonify({"error": "承認できるステータスではありません(提出済である必要があります)"}), 400

        db.execute("""
            UPDATE monthly_reports
            SET status = 'approved', manager_approval_date = ?
            WHERE employee_id = ? AND year = ? AND month = ?
        """, (today_str, employee_id, year, month))
        db.commit()
        return jsonify({"message": "承認しました", "status": "approved", "manager_approval_date": today_str}), 200
    except Exception as e:
        db.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/monthly_reports/remand', methods=['POST'])
@login_required
def remand_monthly_report():
    """月次レポートを差し戻します（部長向け）。

    ステータスを 'remanded' に更新し、差し戻し理由を記録します。

    Returns:
        Response: 差し戻し結果を含むJSONレスポンス。
    """
    data = request.json
    employee_id = data.get('employee_id')
    year = data.get('year')
    month = data.get('month')
    reason = data.get('reason', '')

    if session.get('role') != 'manager':
        return jsonify({"error": "部長権限が必要です"}), 403

    db = get_db()
    try:
        cursor = db.execute("SELECT status FROM monthly_reports WHERE employee_id=? AND year=? AND month=?", (employee_id, year, month))
        row = cursor.fetchone()

        if not row or row['status'] != 'submitted':
             return jsonify({"error": "差戻しできるステータスではありません"}), 400

        db.execute("""
            UPDATE monthly_reports
            SET status = 'remanded', remand_reason = ?
            WHERE employee_id = ? AND year = ? AND month = ?
        """, (reason, employee_id, year, month))
        db.commit()
        return jsonify({"message": "差し戻しました", "status": "remanded", "remand_reason": reason}), 200
    except Exception as e:
        db.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/monthly_reports/finalize', methods=['POST'])
@login_required
def finalize_monthly_report():
    """月次レポートを完了（最終承認）します（経理向け）。

    ステータスを 'finalized' に更新します。経理権限が必要です。

    Returns:
        Response: 完了処理結果を含むJSONレスポンス。
    """
    data = request.json
    employee_id = data.get('employee_id')
    year = data.get('year')
    month = data.get('month')

    if session.get('role') != 'accounting':
        return jsonify({"error": "経理権限が必要です"}), 403

    db = get_db()
    try:
        today_str = datetime.now().strftime('%Y-%m-%d')
        cursor = db.execute("SELECT status FROM monthly_reports WHERE employee_id=? AND year=? AND month=?", (employee_id, year, month))
        row = cursor.fetchone()

        if not row or row['status'] != 'approved':
             return jsonify({"error": "完了できるステータスではありません(部長承認済である必要があります)"}), 400

        # 古い approval_date カラムも更新して後方互換を保つ
        db.execute("""
            UPDATE monthly_reports
            SET status = 'finalized', accounting_approval_date = ?, approval_date = ?
            WHERE employee_id = ? AND year = ? AND month = ?
        """, (today_str, today_str, employee_id, year, month))
        db.commit()
        return jsonify({"message": "完了処理しました", "status": "finalized", "accounting_approval_date": today_str}), 200
    except Exception as e:
        db.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/monthly_reports/overview/<int:year>/<int:month>', methods=['GET'])
@login_required
def get_monthly_reports_overview(year, month):
    """月次レポートの提出状況一覧を取得します（管理者・経理向け）。

    Args:
        year (int): 年。
        month (int): 月。

    Returns:
        Response: 各従業員のレポート状況を含むリストのJSONレスポンス。
    """
    # 権限チェック
    if session.get('role') not in ['manager', 'accounting']:
        return jsonify({"error": "権限がありません"}), 403

    try:
        db = get_db()
        # 退職していない社員を取得し、指定月のレポート状況と結合
        query = """
            SELECT
                e.employee_id,
                e.employee_name,
                e.department_name,
                COALESCE(r.status, 'draft') as status,
                r.submitted_date,
                r.manager_approval_date,
                r.accounting_approval_date,
                r.remand_reason
            FROM employees e
            LEFT JOIN monthly_reports r
              ON e.employee_id = r.employee_id
              AND r.year = ?
              AND r.month = ?
            WHERE e.retirement_flag = 0
            ORDER BY e.employee_id
        """
        cursor = db.execute(query, (year, month))
        overview = [dict(row) for row in cursor.fetchall()]

        return jsonify(overview)

    except Exception as e:
        app.logger.error(f"承認状況取得エラー: {e}")
        return jsonify({"error": "サーバー内部エラー"}), 500

@app.route('/api/monthly_reports/cancel_approval', methods=['POST'])
@login_required
def cancel_approval():
    """承認または提出を取り消します。

    役割に応じて処理が異なります。
    - 経理: 'finalized' -> 'approved'
    - 部長: 'approved' -> 'submitted'
    - 本人: 'submitted' -> 'draft'

    Returns:
        Response: 取り消し結果を含むJSONレスポンス。
    """
    # 既存機能の再実装: 承認を取り消して状態を戻す
    # ロールに応じてどこまで戻すか制御が必要
    # ここではシンプルに: 経理なら finalized -> approved, 部長なら approved -> submitted

    data = request.json
    employee_id = data.get('employee_id')
    year = data.get('year')
    month = data.get('month')
    role = session.get('role')

    db = get_db()
    try:
        cursor = db.execute("SELECT status FROM monthly_reports WHERE employee_id=? AND year=? AND month=?", (employee_id, year, month))
        row = cursor.fetchone()
        if not row: return jsonify({"error": "レポートなし"}), 404
        status = row['status']

        if role == 'accounting' and status == 'finalized':
            db.execute("UPDATE monthly_reports SET status='approved', accounting_approval_date=NULL, approval_date=NULL WHERE employee_id=? AND year=? AND month=?", (employee_id, year, month))
            db.commit()
            return jsonify({"message": "完了を取り消しました", "status": "approved"}), 200

        if role == 'manager' and status == 'approved':
            db.execute("UPDATE monthly_reports SET status='submitted', manager_approval_date=NULL WHERE employee_id=? AND year=? AND month=?", (employee_id, year, month))
            db.commit()
            return jsonify({"message": "承認を取り消しました", "status": "submitted"}), 200

        # 社員が提出を取り消す場合 (まだ承認されていない場合のみ)
        if session.get('user_id') == employee_id and status == 'submitted':
             db.execute("UPDATE monthly_reports SET status='draft', submitted_date=NULL WHERE employee_id=? AND year=? AND month=?", (employee_id, year, month))
             db.commit()
             return jsonify({"message": "提出を取り消しました", "status": "draft"}), 200

        return jsonify({"error": "現在のステータスまたは権限では取り消しできません"}), 403

    except Exception as e:
        db.rollback()
        return jsonify({"error": str(e)}), 500


@app.route('/api/attendance_records/<int:employee_id>/<int:year>/<int:month>', methods=['GET'])
@login_required
def get_attendance_records(employee_id, year, month):
    """指定された従業員、年、月の勤怠管理表用データを取得します。

    日次の勤怠データと月次の集計データを返します。

    Args:
        employee_id (int): 従業員ID。
        year (int): 年。
        month (int): 月。

    Returns:
        Response: 日次レコードと月次集計を含むJSONレスポンス。
    """
    current_user_id = session.get('user_id')
    if current_user_id != employee_id and session.get('role') not in ['manager', 'accounting']:
        return jsonify({"error": "権限がありません"}), 403

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
        return jsonify({
            "daily_records": all_daily_data,
            "monthly_summary": monthly_summary
        })

    except Exception as e:
        app.logger.error(f"勤怠データ取得エラー: {e}")
        return jsonify({"error": "サーバー内部エラー"}), 500

@app.route('/api/attendance_records', methods=['POST'])
@login_required
def save_attendance_records():
    """勤怠管理表のデータを保存します。

    Returns:
        Response: 保存結果を含むJSONレスポンス。
    """
    data = request.json
    employee_id = data.get('employee_id')

    current_user_id = session.get('user_id')
    if current_user_id != employee_id:
         # 勤怠管理表も本人編集限定 (仕様によるが一旦統一)
         return jsonify({"error": "権限がありません"}), 403

    records = data.get('records')
    if not all([employee_id, isinstance(records, list)]):
        return jsonify({"error": "無効なデータです"}), 400

    db = get_db()
    try:
        # ステータスチェックが必要だが、勤怠管理表側はstatusフィールドを持っていない可能性がある。
        # 本来は monthly_reports の status を参照すべき。
        # 簡易的に、渡されたレコードの最初の日付から年月を特定してチェックする。
        if records:
            first_date = records[0].get('date')
            if first_date:
                y, m, d = first_date.split('-')
                cursor = db.execute("SELECT status FROM monthly_reports WHERE employee_id=? AND year=? AND month=?", (employee_id, int(y), int(m)))
                row = cursor.fetchone()
                if row and row['status'] not in ['draft', 'remanded']:
                    return jsonify({"error": "現在のステータスでは編集できません"}), 403

        for record in records:
            date_str = record.get('date')
            if not date_str: continue

            cursor = db.execute(
                "SELECT record_id FROM work_records WHERE employee_id = ? AND date = ?",
                (employee_id, date_str)
            )
            record_row = cursor.fetchone()

            attendance_type = record.get('attendance_type')
            full_day_off_types = [2, 3, 6, 7]

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
        return jsonify({"message": "保存しました"}), 200
    except Exception as e:
        db.rollback()
        return jsonify({"error": "サーバー内部エラー"}), 500

@app.route('/api/daily_report/<int:employee_id>/<string:date_str>', methods=['GET'])
@login_required
def get_daily_report(employee_id, date_str):
    """指定された日報を取得します。

    Args:
        employee_id (int): 従業員ID。
        date_str (str): 'YYYY-MM-DD'形式の日付文字列。

    Returns:
        Response: 日報データを含むJSONレスポンス。
    """
    # 本人または管理者
    if session.get('user_id') != employee_id and session.get('role') not in ['manager', 'accounting']:
         return jsonify({"error": "権限なし"}), 403

    try:
        db = get_db()
        cursor = db.execute(
            'SELECT * FROM daily_reports WHERE employee_id = ? AND date = ?',
            (employee_id, date_str)
        )
        report = cursor.fetchone()
        if report:
            return jsonify(dict(report))
        else:
            return jsonify(None)
    except Exception:
        return jsonify({"error": "サーバー内部エラー"}), 500

@app.route('/api/daily_report', methods=['POST'])
@login_required
def save_daily_report():
    """日報を保存します。

    日報データとともに、対応する日の作業記録（時間など）も更新します。

    Returns:
        Response: 保存結果を含むJSONレスポンス。
    """
    data = request.json
    employee_id = data.get('employee_id')
    date = data.get('date')

    if session.get('user_id') != employee_id:
        return jsonify({"error": "本人以外編集できません"}), 403

    # 日報もステータスチェックが必要 (該当月がロックされていたら日報もロックすべき)
    if date:
        y, m, d = date.split('-')
        db = get_db()
        cursor = db.execute("SELECT status FROM monthly_reports WHERE employee_id=? AND year=? AND month=?", (employee_id, int(y), int(m)))
        row = cursor.fetchone()
        if row and row['status'] not in ['draft', 'remanded']:
             return jsonify({"error": "提出済みのため編集できません"}), 403

    # ... (既存の日報保存ロジック)
    if not all([employee_id, date]):
        return jsonify({"error": "無効なデータです"}), 400

    try:
        db = get_db()
        cursor = db.cursor()
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
        
        work_summary = data.get('work_summary')
        start_time = data.get('start_time')
        end_time = data.get('end_time')
        break_time = data.get('break_time')

        cursor.execute("SELECT record_id FROM work_records WHERE employee_id = ? AND date = ?", (employee_id, date))
        record_row = cursor.fetchone()
        record_id = None

        if record_row:
            record_id = record_row['record_id']
            cursor.execute(
                "UPDATE work_records SET work_content = ?, start_time = ?, end_time = ?, break_time = ? WHERE record_id = ?",
                (work_summary, start_time, end_time, break_time, record_id)
            )
        else:
            cursor.execute(
                "INSERT INTO work_records (employee_id, date, work_content, start_time, end_time, break_time) VALUES (?, ?, ?, ?, ?, ?)",
                (employee_id, date, work_summary, start_time, end_time, break_time)
            )
            record_id = cursor.lastrowid

        details = data.get('details')
        if details is not None:
            cursor.execute("DELETE FROM work_record_details WHERE record_id = ?", (record_id,))
            for detail in details:
                client_id = detail.get('client_id')
                project_id = detail.get('project_id')
                work_time = detail.get('work_time')
                if client_id and project_id and work_time is not None:
                    cursor.execute("""
                        INSERT INTO work_record_details (record_id, client_id, project_id, work_time)
                        VALUES (?, ?, ?, ?)
                    """, (record_id, client_id, project_id, work_time))

        db.commit()
        return jsonify({"message": "日報を保存しました"}), 200
    except Exception as e:
        db.rollback()
        return jsonify({"error": "サーバー内部エラー"}), 500

@app.route('/api/employee', methods=['POST'])
@login_required
def add_employee():
    """新しい社員を追加します（管理者・経理向け）。

    初期パスワードは '123' に設定されます。

    Returns:
        Response: 作成された社員IDを含むJSONレスポンス。
    """
    # 既存の auth_user_id は無視してセッションを使う
    if session.get('role') not in ['manager', 'accounting']:
         return jsonify({"error": "権限がありません"}), 403

    data = request.json
    try:
        db = get_db()
        cursor = db.cursor()
        password_hash = generate_password_hash('123')

        # roleの取得 (デフォルトは employee)
        role = data.get('role', 'employee')

        cursor.execute("""
            INSERT INTO employees (company_id, employee_name, department_name, employee_type, role, retirement_flag, password)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            data.get('company_id'),
            data.get('employee_name'),
            data.get('department_name'),
            data.get('employee_type'),
            role,
            1 if data.get('retirement_flag') else 0,
            password_hash
        ))
        db.commit()
        return jsonify({"message": "社員を追加しました", "employee_id": cursor.lastrowid}), 201
    except Exception:
        db.rollback()
        return jsonify({"error": "エラー"}), 500

@app.route('/api/employee/<int:employee_id>', methods=['PUT'])
@login_required
def update_employee(employee_id):
    """社員情報を更新します（管理者・経理向け）。

    Args:
        employee_id (int): 更新対象の社員ID。

    Returns:
        Response: 更新結果を含むJSONレスポンス。
    """
    if session.get('role') not in ['manager', 'accounting']:
         return jsonify({"error": "権限がありません"}), 403

    data = request.json
    try:
        db = get_db()

        # roleの更新も含める
        db.execute("""
            UPDATE employees SET
            employee_name = ?, department_name = ?, employee_type = ?, role = ?,
            retirement_flag = ?
            WHERE employee_id = ?
        """, (
            data.get('employee_name'),
            data.get('department_name'),
            data.get('employee_type'),
            data.get('role'),
            1 if data.get('retirement_flag') else 0,
            employee_id
        ))
        db.commit()
        return jsonify({"message": "社員情報を更新しました"}), 200
    except Exception:
        db.rollback()
        return jsonify({"error": "エラー"}), 500

# -----------------------------------------------------------------------------
# フロントエンド配信
# -----------------------------------------------------------------------------
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_frontend(path):
    """フロントエンドの静的ファイルを配信します。

    SPA（Single Page Application）に対応するため、ファイルが見つからない場合は
    `index.html` を返します。

    Args:
        path (str): リクエストされたパス。

    Returns:
        Response: 静的ファイルまたは `index.html`。
    """
    static_folder_path = app.static_folder
    if path != "" and os.path.exists(os.path.join(static_folder_path, path)):
        return send_from_directory(static_folder_path, path)
    else:
        return send_from_directory(static_folder_path, 'index.html')

if __name__ == '__main__':
    app.run(debug=True, use_reloader=False, port=5000)
