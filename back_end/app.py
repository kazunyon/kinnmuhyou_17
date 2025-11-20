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

    Flaskの`g`オブジェクトは、リクエストごとにユニークなグローバル名前空間として機能します。
    これを利用して、同じリクエスト内でデータベース接続を一度だけ作成し、再利用します。
    接続が存在しない場合にのみ新しい接続を確立することで、効率的なリソース管理を実現します。
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
        # パスワードハッシュがフロントエンドに渡らないように、レスポンスから削除する
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
    認証が成功した場合、ユーザーがシステムのオーナーであるかどうかのフラグも返します。

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

        # パスワードがハッシュ化されているため、check_password_hashで比較する
        if user and user['password'] and check_password_hash(user['password'], password):
            # 認証成功後、オーナーIDと一致するかを確認
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

@app.route('/api/clients', methods=['GET'])
def get_clients():
    """取引先マスターの全データを取得します。"""
    try:
        db = get_db()
        cursor = db.execute('SELECT * FROM clients ORDER BY client_name')
        clients = [dict(row) for row in cursor.fetchall()]
        return jsonify(clients)
    except Exception as e:
        app.logger.error(f"取引先データ取得エラー: {e}")
        return jsonify({"error": "サーバー内部エラー"}), 500

@app.route('/api/projects', methods=['GET'])
def get_projects():
    """案件マスターの全データを取得します。取引先名も結合して返します。"""
    try:
        db = get_db()
        cursor = db.execute("""
            SELECT p.project_id, p.project_name, p.client_id, c.client_name
            FROM projects p
            JOIN clients c ON p.client_id = c.client_id
            ORDER BY c.client_name, p.project_name
        """)
        projects = [dict(row) for row in cursor.fetchall()]
        return jsonify(projects)
    except Exception as e:
        app.logger.error(f"案件データ取得エラー: {e}")
        return jsonify({"error": "サーバー内部エラー"}), 500

@app.route('/api/clients', methods=['POST'])
def add_client():
    """新しい取引先を追加します。オーナー認証が必要です。"""
    data = request.json
    if not is_valid_owner(data.get('owner_id'), data.get('owner_password')):
        return jsonify({"error": "権限がありません"}), 403

    client_name = data.get('client_name')
    if not client_name:
        return jsonify({"error": "取引先名は必須です"}), 400

    try:
        db = get_db()
        cursor = db.execute("INSERT INTO clients (client_name) VALUES (?)", (client_name,))
        db.commit()
        return jsonify({"message": "取引先を追加しました", "client_id": cursor.lastrowid}), 201
    except sqlite3.IntegrityError:
        db.rollback()
        return jsonify({"error": "その取引先名は既に存在します"}), 409
    except Exception as e:
        db.rollback()
        app.logger.error(f"取引先追加エラー: {e}")
        return jsonify({"error": "サーバー内部エラー"}), 500

@app.route('/api/clients/<int:client_id>', methods=['PUT'])
def update_client(client_id):
    """取引先名を更新します。オーナー認証が必要です。"""
    data = request.json
    if not is_valid_owner(data.get('owner_id'), data.get('owner_password')):
        return jsonify({"error": "権限がありません"}), 403

    new_name = data.get('client_name')
    if not new_name:
        return jsonify({"error": "取引先名は必須です"}), 400

    try:
        db = get_db()
        db.execute("UPDATE clients SET client_name = ? WHERE client_id = ?", (new_name, client_id))
        db.commit()
        return jsonify({"message": "取引先を更新しました"}), 200
    except sqlite3.IntegrityError:
        db.rollback()
        return jsonify({"error": "その取引先名は既に存在します"}), 409
    except Exception as e:
        db.rollback()
        app.logger.error(f"取引先更新エラー: {e}")
        return jsonify({"error": "サーバー内部エラー"}), 500

@app.route('/api/clients/<int:client_id>', methods=['DELETE'])
def delete_client(client_id):
    """取引先を削除します。オーナー認証が必要です。"""
    data = request.json
    if not is_valid_owner(data.get('owner_id'), data.get('owner_password')):
        return jsonify({"error": "権限がありません"}), 403

    try:
        db = get_db()
        # 関連する案件がないかチェック
        cursor = db.execute("SELECT 1 FROM projects WHERE client_id = ?", (client_id,))
        if cursor.fetchone():
            return jsonify({"error": "この取引先には案件が紐付いているため削除できません"}), 400

        db.execute("DELETE FROM clients WHERE client_id = ?", (client_id,))
        db.commit()
        return jsonify({"message": "取引先を削除しました"}), 200
    except Exception as e:
        db.rollback()
        app.logger.error(f"取引先削除エラー: {e}")
        return jsonify({"error": "サーバー内部エラー"}), 500

@app.route('/api/projects', methods=['POST'])
def add_project():
    """新しい案件を追加します。オーナー認証が必要です。"""
    data = request.json
    if not is_valid_owner(data.get('owner_id'), data.get('owner_password')):
        return jsonify({"error": "権限がありません"}), 403

    client_id = data.get('client_id')
    project_name = data.get('project_name')
    if not all([client_id, project_name]):
        return jsonify({"error": "取引先と案件名は必須です"}), 400

    try:
        db = get_db()
        cursor = db.execute("INSERT INTO projects (client_id, project_name) VALUES (?, ?)", (client_id, project_name))
        db.commit()
        return jsonify({"message": "案件を追加しました", "project_id": cursor.lastrowid}), 201
    except sqlite3.IntegrityError:
        db.rollback()
        return jsonify({"error": "その案件名は既にこの取引先に存在します"}), 409
    except Exception as e:
        db.rollback()
        app.logger.error(f"案件追加エラー: {e}")
        return jsonify({"error": "サーバー内部エラー"}), 500

@app.route('/api/projects/<int:project_id>', methods=['PUT'])
def update_project(project_id):
    """案件を更新します。オーナー認証が必要です。"""
    data = request.json
    if not is_valid_owner(data.get('owner_id'), data.get('owner_password')):
        return jsonify({"error": "権限がありません"}), 403

    client_id = data.get('client_id')
    project_name = data.get('project_name')
    if not all([client_id, project_name]):
        return jsonify({"error": "取引先と案件名は必須です"}), 400

    try:
        db = get_db()
        db.execute("UPDATE projects SET client_id = ?, project_name = ? WHERE project_id = ?", (client_id, project_name, project_id))
        db.commit()
        return jsonify({"message": "案件を更新しました"}), 200
    except sqlite3.IntegrityError:
        db.rollback()
        return jsonify({"error": "その案件名は既にこの取引先に存在します"}), 409
    except Exception as e:
        db.rollback()
        app.logger.error(f"案件更新エラー: {e}")
        return jsonify({"error": "サーバー内部エラー"}), 500

@app.route('/api/projects/<int:project_id>', methods=['DELETE'])
def delete_project(project_id):
    """案件を削除します。オーナー認証が必要です。"""
    data = request.json
    if not is_valid_owner(data.get('owner_id'), data.get('owner_password')):
        return jsonify({"error": "権限がありません"}), 403
    try:
        db = get_db()
        # 関連する作業明細がないかチェック (念のため)
        cursor = db.execute("SELECT 1 FROM work_record_details WHERE project_id = ?", (project_id,))
        if cursor.fetchone():
            return jsonify({"error": "この案件には作業記録が紐付いているため削除できません"}), 400

        db.execute("DELETE FROM projects WHERE project_id = ?", (project_id,))
        db.commit()
        return jsonify({"message": "案件を削除しました"}), 200
    except Exception as e:
        db.rollback()
        app.logger.error(f"案件削除エラー: {e}")
        return jsonify({"error": "サーバー内部エラー"}), 500

# -----------------------------------------------------------------------------
# APIエンドポイント: 作業報告書関連
# -----------------------------------------------------------------------------

@app.route('/api/work_records/<int:employee_id>/<int:year>/<int:month>', methods=['GET'])
def get_work_records(employee_id, year, month):
    """作業報告書データを取得。作業明細を含み、月次サマリーと請求先別集計も行います。"""
    try:
        db = get_db()
        calculator = AttendanceCalculator()
        year_str, month_str = str(year), f"{month:02d}"

        # 1. 該当月の作業記録(ヘッダー)とそれに関連する明細(ディテール)を取得
        records_cursor = db.execute("""
            SELECT *, CAST(strftime('%d', date) AS INTEGER) as day
            FROM work_records
            WHERE employee_id = ? AND strftime('%Y', date) = ? AND strftime('%m', date) = ?
        """, (employee_id, year_str, month_str))

        records_for_display = []
        for row in records_cursor.fetchall():
            record = dict(row)
            details_cursor = db.execute("""
                SELECT d.detail_id, d.work_time, d.project_id,
                       p.project_name, p.client_id, c.client_name
                FROM work_record_details d
                JOIN projects p ON d.project_id = p.project_id
                JOIN clients c ON p.client_id = c.client_id
                WHERE d.record_id = ?
            """, (record['record_id'],))
            record['details'] = [dict(detail_row) for detail_row in details_cursor.fetchall()]
            records_for_display.append(record)

        # 2. 月次集計のために、日付をキーとする辞書に変換
        records_map = {r['day']: r for r in records_for_display}

        # 3. 集計計算に必要な祝日データを取得
        holidays_cursor = db.execute("SELECT date FROM holidays WHERE strftime('%Y', date) = ?", (year_str,))
        holidays_set = {row['date'] for row in holidays_cursor.fetchall()}

        # 4. 月の全日ループ (月次サマリー計算ロジック)
        _, num_days = calendar.monthrange(year, month)
        all_daily_data_for_summary = []
        for day in range(1, num_days + 1):
            date_str = f"{year:04d}-{month:02d}-{day:02d}"
            db_record = records_map.get(day, {})
            weekday = datetime(year, month, day).weekday()
            is_holiday_from_calendar = date_str in holidays_set or weekday in [5, 6]
            calc_input = {'start_time': db_record.get('start_time'),'end_time': db_record.get('end_time'),'break_time': db_record.get('break_time'),'night_break_time': db_record.get('night_break_time'),'holiday_type': db_record.get('holiday_type'),'is_holiday_from_calendar': is_holiday_from_calendar}
            daily_summary = calculator.calculate_daily_summary(calc_input)
            all_daily_data_for_summary.append({"attendance_type": db_record.get('attendance_type'), "daily_summary": daily_summary})

        # 5. 月次サマリーを計算
        monthly_summary = calculator.calculate_monthly_summary(all_daily_data_for_summary)

        # 6. DB保存の月次レポート情報とマージ
        report_cursor = db.execute("SELECT * FROM monthly_reports WHERE employee_id = ? AND year = ? AND month = ?", (employee_id, year, month))
        report_row = report_cursor.fetchone()
        special_notes, approval_date = "", None
        manual_summary_fields = {'absent_days': 0, 'paid_holidays': 0, 'compensatory_holidays': 0, 'substitute_holidays': 0, 'late_days': 0, 'early_leave_days': 0, 'holiday_work_days': 0}
        if report_row:
            special_notes = report_row['special_notes'] or ""
            approval_date = report_row['approval_date']
            for field in manual_summary_fields.keys():
                if report_row[field] is not None:
                    manual_summary_fields[field] = report_row[field]
        monthly_summary.update(manual_summary_fields)

        # 7. 請求先・案件別の月次工数集計
        billing_summary_cursor = db.execute("""
            SELECT
                c.client_name,
                p.project_name,
                SUM(wd.work_time) as total_hours
            FROM work_record_details wd
            JOIN work_records wr ON wd.record_id = wr.record_id
            JOIN projects p ON wd.project_id = p.project_id
            JOIN clients c ON p.client_id = c.client_id
            WHERE
                wr.employee_id = ? AND
                strftime('%Y', wr.date) = ? AND
                strftime('%m', wr.date) = ?
            GROUP BY
                c.client_name, p.project_name
            ORDER BY
                c.client_name, p.project_name
        """, (employee_id, year_str, month_str))
        billing_summary = [dict(row) for row in billing_summary_cursor.fetchall()]
        app.logger.info(f"請求先別集計: {len(billing_summary)}件")

        app.logger.info(f"作業記録取得: 社員ID={employee_id}, 年月={year}-{month}, {len(records_for_display)}件")
        return jsonify({
            "records": records_for_display,
            "special_notes": special_notes,
            "approval_date": approval_date,
            "monthly_summary": monthly_summary,
            "billing_summary": billing_summary
        })
    except Exception as e:
        app.logger.error(f"作業記録取得エラー: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": "サーバー内部エラー"}), 500

@app.route('/api/work_records', methods=['POST'])
def save_work_records():
    """作業報告書の日次記録(ヘッダー/ディテール)と月次特記事項を保存します。"""
    data = request.json
    employee_id, year, month = data.get('employee_id'), data.get('year'), data.get('month')
    records, special_notes, monthly_summary = data.get('records'), data.get('special_notes'), data.get('monthly_summary', {})

    if not all([employee_id, year, month, isinstance(records, list)]):
        return jsonify({"error": "無効なデータです"}), 400

    owner_id = get_owner_id()
    if employee_id != owner_id:
        return jsonify({"error": "作業記録を更新する権限がありません。"}), 403

    db = get_db()
    try:
        # 1. 月次レポートをUPSERT
        cursor = db.execute("SELECT report_id FROM monthly_reports WHERE employee_id = ? AND year = ? AND month = ?", (employee_id, year, month))
        report_row = cursor.fetchone()

        report_params = {
            "employee_id": employee_id, "year": year, "month": month, "special_notes": special_notes,
            **{k: monthly_summary.get(k) for k in [
                'absent_days', 'paid_holidays', 'compensatory_holidays', 'substitute_holidays',
                'late_days', 'early_leave_days', 'holiday_work_days'
            ]}
        }

        if report_row:
            db.execute("""
                UPDATE monthly_reports SET special_notes = :special_notes, absent_days = :absent_days,
                paid_holidays = :paid_holidays, compensatory_holidays = :compensatory_holidays,
                substitute_holidays = :substitute_holidays, late_days = :late_days,
                early_leave_days = :early_leave_days, holiday_work_days = :holiday_work_days
                WHERE report_id = :report_id
            """, {**report_params, "report_id": report_row['report_id']})
        else:
            db.execute("""
                INSERT INTO monthly_reports (employee_id, year, month, special_notes, absent_days,
                paid_holidays, compensatory_holidays, substitute_holidays, late_days,
                early_leave_days, holiday_work_days) VALUES (:employee_id, :year, :month,
                :special_notes, :absent_days, :paid_holidays, :compensatory_holidays,
                :substitute_holidays, :late_days, :early_leave_days, :holiday_work_days)
            """, report_params)

        # 2. 日次作業記録(ヘッダーとディテール)をループでUPSERT
        for record in records:
            day = record.get('day')
            if day is None: continue
            date_str = f"{year}-{month:02d}-{day:02d}"
            
            cursor = db.execute("SELECT record_id FROM work_records WHERE employee_id = ? AND date = ?", (employee_id, date_str))
            record_row = cursor.fetchone()

            header_params = {
                'employee_id': employee_id, 'date': date_str,
                'start_time': record.get('start_time'), 'end_time': record.get('end_time'),
                'break_time': record.get('break_time')
            }

            if record_row:
                current_record_id = record_row['record_id']
                db.execute("UPDATE work_records SET start_time = :start_time, end_time = :end_time, break_time = :break_time WHERE record_id = :record_id",
                           {**header_params, 'record_id': current_record_id})
            else:
                cursor = db.execute("INSERT INTO work_records (employee_id, date, start_time, end_time, break_time) VALUES (:employee_id, :date, :start_time, :end_time, :break_time)",
                                  header_params)
                current_record_id = cursor.lastrowid

            # 既存の明細を削除してから新しい明細を挿入
            db.execute("DELETE FROM work_record_details WHERE record_id = ?", (current_record_id,))
            details = record.get('details', [])
            if details:
                detail_params = [
                    (current_record_id, detail.get('project_id'), detail.get('work_time'))
                    for detail in details if detail.get('project_id') and detail.get('work_time')
                ]
                if detail_params:
                    db.executemany("INSERT INTO work_record_details (record_id, project_id, work_time) VALUES (?, ?, ?)",
                                   detail_params)
        db.commit()
        app.logger.info(f"作業記録保存成功: 社員ID={employee_id}, 年月={year}-{month}")
        return jsonify({"message": "保存しました"}), 200
    except sqlite3.Error as e:
        db.rollback()
        app.logger.error(f"作業記録保存エラー (DB): {e}")
        return jsonify({"error": "データベースエラー"}), 500

@app.route('/api/monthly_reports/approve', methods=['POST'])
def approve_monthly_report():
    """月次レポートを承認し、承認日を記録します。

    この操作は、リクエスト元の`employee_id`がシステムのオーナーIDと一致する場合にのみ許可されます。
    もし対象の年月に月次レポート（`monthly_reports`テーブルのレコード）が存在しない場合は、
    この承認のタイミングで新規作成します。

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

    # セキュリティチェック: オーナーのみが承認可能
    owner_id = get_owner_id()
    if employee_id != owner_id:
        return jsonify({"error": "レポートを承認する権限がありません。"}), 403

    db = get_db()
    try:
        today_str = datetime.now().strftime('%Y-%m-%d')

        # UPSERT処理: monthly_reportsにレコードがあるか確認
        cursor = db.execute(
            "SELECT report_id FROM monthly_reports WHERE employee_id = ? AND year = ? AND month = ?",
            (employee_id, year, month)
        )
        report_row = cursor.fetchone()

        if report_row:
            # 存在すればUPDATEで承認日を設定
            db.execute(
                "UPDATE monthly_reports SET approval_date = ? WHERE report_id = ?",
                (today_str, report_row['report_id'])
            )
        else:
            # 存在しなければINSERTで承認日と共に新規作成
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

    この操作は、リクエスト元の`employee_id`がシステムのオーナーIDと一致する場合にのみ許可されます。

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

    # セキュリティチェック: オーナーのみが承認取り消し可能
    owner_id = get_owner_id()
    if employee_id != owner_id:
        return jsonify({"error": "承認を取り消す権限がありません。"}), 403

    db = get_db()
    try:
        # レポートが存在するか確認
        cursor = db.execute(
            "SELECT report_id FROM monthly_reports WHERE employee_id = ? AND year = ? AND month = ?",
            (employee_id, year, month)
        )
        report_row = cursor.fetchone()

        if report_row:
            # レポートが存在すれば承認日をNULLに更新
            db.execute(
                "UPDATE monthly_reports SET approval_date = NULL WHERE report_id = ?",
                (report_row['report_id'],)
            )
            db.commit()
            app.logger.info(f"レポート承認取り消し成功: 社員ID={employee_id}, 年月={year}-{month}")
            return jsonify({"message": "承認を取り消しました", "approval_date": None}), 200
        else:
            # 承認を取り消そうとしたが、そもそもレポートが存在しなかった場合
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
    """勤怠管理表データを取得。備考欄に作業明細と日報を結合します。"""
    try:
        db = get_db()
        calculator = AttendanceCalculator()
        year_str, month_str = f"{year:04d}", f"{month:02d}"

        # 1. 必要なデータを並行して取得
        records_cursor = db.execute("SELECT * FROM work_records WHERE employee_id = ? AND strftime('%Y', date) = ? AND strftime('%m', date) = ?", (employee_id, year_str, month_str))
        records_map = {row['date']: dict(row) for row in records_cursor.fetchall()}

        details_cursor = db.execute("""
            SELECT wr.date, c.client_name, p.project_name, wd.work_time
            FROM work_record_details wd
            JOIN work_records wr ON wd.record_id = wr.record_id
            JOIN projects p ON wd.project_id = p.project_id
            JOIN clients c ON p.client_id = c.client_id
            WHERE wr.employee_id = ? AND strftime('%Y', wr.date) = ? AND strftime('%m', wr.date) = ?
        """, (employee_id, year_str, month_str))
        details_map = {}
        for row in details_cursor.fetchall():
            details_map.setdefault(row['date'], []).append(f"{row['client_name']} - {row['project_name']} ({row['work_time']})")

        reports_cursor = db.execute("SELECT date, work_summary FROM daily_reports WHERE employee_id = ? AND strftime('%Y', date) = ? AND strftime('%m', date) = ?", (employee_id, year_str, month_str))
        reports_map = {row['date']: row['work_summary'] for row in reports_cursor.fetchall()}

        holidays_cursor = db.execute("SELECT date FROM holidays WHERE strftime('%Y', date) = ?", (year_str,))
        holidays_set = {row['date'] for row in holidays_cursor.fetchall()}

        # 2. 月の全日分のデータを生成
        _, num_days = calendar.monthrange(year, month)
        all_daily_data = []
        for day in range(1, num_days + 1):
            date_str = f"{year_str}-{month_str}-{day:02d}"
            db_record = records_map.get(date_str, {})

            remarks_parts = []
            if date_str in details_map:
                remarks_parts.append("[作業明細] " + " / ".join(details_map[date_str]))

            if date_str in reports_map and reports_map[date_str]:
                remarks_parts.append("[日報] " + reports_map[date_str])

            remarks = " ".join(remarks_parts)

            weekday = datetime(year, month, day).weekday()
            is_holiday_from_calendar = date_str in holidays_set or weekday in [5, 6]
            calc_input = {k: db_record.get(k) for k in ['start_time', 'end_time', 'break_time', 'night_break_time', 'holiday_type']}
            calc_input['is_holiday_from_calendar'] = is_holiday_from_calendar
            daily_summary = calculator.calculate_daily_summary(calc_input)

            # daily_data の remarks を更新
            daily_data = {
                **{k: db_record.get(k) for k in ['holiday_type', 'attendance_type', 'start_time', 'end_time', 'break_time', 'night_break_time']},
                "day": day,
                "date": date_str,
                "weekday": weekday,
                "remarks": remarks,
                "daily_summary": daily_summary
            }
            all_daily_data.append(daily_data)

        monthly_summary = calculator.calculate_monthly_summary([{"daily_summary": r['daily_summary'], "attendance_type": r.get('attendance_type')} for r in all_daily_data])

        app.logger.info(f"勤怠データ取得成功: 社員ID={employee_id}, 年月={year}-{month}")
        return jsonify({"daily_records": all_daily_data, "monthly_summary": monthly_summary})
    except Exception as e:
        app.logger.error(f"勤怠データ取得エラー: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": "サーバー内部エラー"}), 500

@app.route('/api/attendance_records', methods=['POST'])
def save_attendance_records():
    """勤怠管理表からの日次勤怠データを保存します（UPSERT処理）。

    作業報告書よりも詳細な勤怠情報（勤怠種別、深夜休憩など）を扱います。
    データが存在しない場合は新規作成（INSERT）、存在する場合は更新（UPDATE）します。

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

            # UPSERTのため、まずレコードの存在を確認
            cursor = db.execute(
                "SELECT record_id FROM work_records WHERE employee_id = ? AND date = ?",
                (employee_id, date_str)
            )
            record_row = cursor.fetchone()

            attendance_type = record.get('attendance_type')

            # 全日休みの勤怠種別リスト (2:欠勤, 3:有給, 6:代休, 7:振休)
            full_day_off_types = [2, 3, 6, 7]

            # 勤怠種別が「全日休み」に該当する場合、データの整合性を保つため、
            # 時刻関連のデータを強制的に "00:00" に上書きします。
            # これにより、UI上で時刻が入力されていてもDBには保存されず、計算ミスを防ぎます。
            if attendance_type in full_day_off_types:
                start_time = "00:00"
                end_time = "00:00"
                break_time = "00:00"
                night_break_time = "00:00"
            else:
                # それ以外の勤怠種別（出勤、午前半休など）の場合は、リクエストの値をそのまま使用
                start_time = record.get('start_time')
                end_time = record.get('end_time')
                break_time = record.get('break_time')
                night_break_time = record.get('night_break_time')

            # DBに保存するパラメータを辞書として準備
            params = {
                'employee_id': employee_id,
                'date': date_str,
                'holiday_type': record.get('holiday_type'),
                'attendance_type': attendance_type,
                'start_time': start_time,
                'end_time': end_time,
                'break_time': break_time,
                'night_break_time': night_break_time,
            }

            if record_row:
                # レコードが存在すればUPDATE
                params['record_id'] = record_row['record_id']
                db.execute("""
                    UPDATE work_records SET
                    holiday_type=:holiday_type, attendance_type=:attendance_type, start_time=:start_time,
                    end_time=:end_time, break_time=:break_time, night_break_time=:night_break_time
                    WHERE record_id=:record_id
                """, params)
            else:
                # レコードが存在しなければINSERT
                db.execute("""
                    INSERT INTO work_records (
                        employee_id, date, holiday_type, attendance_type, start_time,
                        end_time, break_time, night_break_time
                    ) VALUES (
                        :employee_id, :date, :holiday_type, :attendance_type, :start_time,
                        :end_time, :break_time, :night_break_time
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
            return jsonify(None) # フロントエンドで扱いやすいようにnullを返す
    except Exception as e:
        app.logger.error(f"日報データ取得エラー: {e}")
        return jsonify({"error": "サーバー内部エラー"}), 500

@app.route('/api/daily_report', methods=['POST'])
def save_daily_report():
    """日報データを保存（UPSERT）し、関連する作業記録も更新します。

    データの一貫性を保つため、このエンドポイントでは2つのテーブルを更新します。
    1. `daily_reports`: 日報の詳細な内容（業務サマリー、課題、所感など）を保存。
    2. `work_records`: `daily_reports`の`work_summary`（業務サマリー）を
                       `work_records`の`work_content`（作業内容）にコピーします。
                       これにより、作業報告書や勤怠管理表にも日報のサマリーが表示されるようになります。

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
    """
    data = request.json
    employee_id = data.get('employee_id')
    date = data.get('date')
    
    # ★★★ デバッグ用に追加 (ここから) ★★★
#    app.logger.info(f"save_daily_report が受信したデータ: {data}")
    # ★★★ デバッグ用に追加 (ここまで) ★★★

    if not all([employee_id, date]):
        return jsonify({"error": "無効なデータです"}), 400

    try:
        db = get_db()
        cursor = db.cursor()

        # 1. daily_reports テーブルをUPSERT
        cursor.execute("SELECT 1 FROM daily_reports WHERE employee_id = ? AND date = ?", (employee_id, date))
        exists = cursor.fetchone()

        if exists:
            # 存在すればUPDATE
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
            # 存在しなければINSERT
            cursor.execute("""
                INSERT INTO daily_reports 
                (employee_id, date, work_summary, problems, challenges, tomorrow_tasks, thoughts)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                employee_id, date, data.get('work_summary'), data.get('problems'),
                data.get('challenges'), data.get('tomorrow_tasks'), data.get('thoughts')
            ))
        

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

    このファイルはアプリケーションのルートディレクトリに配置されることを想定しています。
    ファイルが存在しない、または内容が整数でない場合は、
    フォールバックとしてデフォルトのID 1を返します。

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
        app.logger.error(f"num.idファイルの読み込みに失敗しました ({e})。デフォルトのオーナーID(1)を使用します。")
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
    """ヘルパー関数: 指定された社員IDが所属する会社のIDを取得します。"""
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
    """ヘルパー関数: 提供されたIDとパスワードが正規のオーナーのものであるかを検証します。

    セキュリティの要となる関数です。
    1. `get_owner_id()`で取得した真のオーナーIDと、リクエストされた`owner_id`が一致するかを確認します。
    2. データベースに保存されているハッシュ化されたパスワードと、リクエストされた`password`が一致するかを
       `check_password_hash`で安全に比較します。

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

    この操作は、リクエストに含まれる認証情報が正規のオーナーのものであり、
    かつ、追加しようとしている社員の所属会社がオーナー自身の所属会社と同じである
    場合にのみ許可されます。
    """
    data = request.json
    owner_id = data.get('owner_id')
    owner_password = data.get('owner_password')
    target_company_id = data.get('company_id')

    # セキュリティチェック1: 正規のオーナーか？
    if not is_valid_owner(owner_id, owner_password):
        return jsonify({"error": "この操作を行う権限がありません"}), 403

    # セキュリティチェック2: オーナーが所属する会社と、追加対象の社員の会社が同じか？
    owner_company_id = _get_employee_company_id(owner_id)
    if not owner_company_id or owner_company_id != target_company_id:
        app.logger.warning(f"権限のない社員追加試行: オーナー(会社ID:{owner_company_id})が別会社(ID:{target_company_id})の社員を追加しようとしました。")
        return jsonify({"error": "自分の会社以外の社員は追加できません"}), 403

    try:
        db = get_db()
        cursor = db.cursor()

        # 新規社員の初期パスワードは '123' に設定
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
    更新する場合にのみ許可されます。パスワードの更新はこのエンドポイントでは行いません。
    """
    data = request.json
    owner_id = data.get('owner_id')
    owner_password = data.get('owner_password')

    # セキュリティチェック1: 正規のオーナーか？
    if not is_valid_owner(owner_id, owner_password):
        return jsonify({"error": "この操作を行う権限がありません"}), 403

    # セキュリティチェック2: オーナーと更新対象社員が同じ会社に所属しているか？
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
        db.commit()
        app.logger.info(f"社員情報（パスワードを除く）を更新しました: ID={employee_id}")
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

    リクエストされたパスが`static_folder`（例: '../front_end/dist'）内に
    物理的なファイルとして存在する場合（例: /static/js/main.js）、そのファイルを配信します。

    パスがファイルとして存在しない場合（例: /users/123）、React Routerなどの
    クライアントサイドのルーティングが処理できるように、アプリケーションのエントリーポイントである
    `index.html`を配信します。これにより、URLを直接入力してもReactアプリが正しく表示されます。

    Args:
        path (str): リクエストされたパス。

    Returns:
        Response: 静的ファイルまたはindex.htmlの内容。
    """
    app.logger.info(f"フロントエンド配信リクエスト受信: path='{path}'")
    static_folder_path = app.static_folder

    # リクエストされたパスが物理ファイルとして存在するかチェック
    if path != "" and os.path.exists(os.path.join(static_folder_path, path)):
        app.logger.info(f"静的ファイル '{path}' を配信します。")
        return send_from_directory(static_folder_path, path)
    else:
        # 存在しない場合は、クライアントサイドのルーティングに任せるためindex.htmlを返す
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
