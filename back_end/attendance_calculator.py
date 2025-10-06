from datetime import datetime, timedelta, time

# --- 定数定義 ---
# NOTE: ユーザーの確認に基づき、所定・法定労働時間を設定。
# 将来的にこれらの値はDBや設定ファイルから取得する想定。
STANDARD_WORK_HOURS = timedelta(hours=8)  # 所定労働時間
LEGAL_WORK_HOURS = timedelta(hours=8)     # 法定労働時間
LATE_NIGHT_START_TIME = time(22, 0) # 深夜労働の開始時刻
LATE_NIGHT_END_TIME = time(5, 0)    # 深夜労働の終了時刻
# NOTE: 仕様書に基づき、半休扱いの勤怠種別を定義
HALF_DAY_ATTENDANCE_TYPES = ['半休', '半有休', 'AM半休', 'PM半休']


class AttendanceCalculator:
    """
    勤怠データの日次および月次の集計を計算するクラス。
    """

    def _parse_time_to_timedelta(self, time_str: str | None) -> timedelta:
        """'HH:MM'形式の文字列をtimedeltaに変換する。無効な場合は0を返す。"""
        if not time_str:
            return timedelta(0)
        try:
            if time_str.startswith('24:'):
                time_str = time_str.replace('24:', '00:')
                base_delta = timedelta(hours=24)
            else:
                base_delta = timedelta(0)

            h, m = map(int, time_str.split(':'))
            return base_delta + timedelta(hours=h, minutes=m)
        except (ValueError, AttributeError):
            return timedelta(0)

    def _format_timedelta(self, td: timedelta) -> str:
        """timedeltaオブジェクトを 'HH:MM' 形式の文字列にフォーマットする。"""
        if not isinstance(td, timedelta) or td.total_seconds() < 0:
            return "0:00"
        total_seconds = td.total_seconds()
        hours = int(total_seconds // 3600)
        minutes = int((total_seconds % 3600) // 60)
        return f"{hours}:{minutes:02d}"

    def _calculate_late_night_duration(self, start_td: timedelta, end_td: timedelta) -> timedelta:
        """勤務時間内の深夜労働時間を計算する。"""
        work_start_s = start_td.total_seconds()
        work_end_s = end_td.total_seconds()
        if work_end_s < work_start_s:
            work_end_s += 24 * 3600

        # 深夜時間帯を秒単位で定義
        ln_intervals = [
            (0, 5 * 3600),                      # 00:00 - 05:00
            (22 * 3600, 24 * 3600),             # 22:00 - 24:00
            (24 * 3600, (24 + 5) * 3600)        # 翌日の 00:00 - 05:00
        ]

        total_ln_seconds = 0
        for ln_start, ln_end in ln_intervals:
            overlap_start = max(work_start_s, ln_start)
            overlap_end = min(work_end_s, ln_end)
            overlap_duration = max(0, overlap_end - overlap_start)
            total_ln_seconds += overlap_duration

        return timedelta(seconds=total_ln_seconds)

    def calculate_daily_summary(self, record: dict) -> dict:
        """
        1日分の勤務記録を受け取り、各項目の集計値を計算して返す。
        """
        start_td = self._parse_time_to_timedelta(record.get('start_time'))
        end_td = self._parse_time_to_timedelta(record.get('end_time'))
        break_td = self._parse_time_to_timedelta(record.get('break_time'))
        night_break_td = self._parse_time_to_timedelta(record.get('night_break_time'))

        # 開始・終了時刻がなければ計算しない
        if start_td == timedelta(0) and end_td == timedelta(0):
            return {
                'working_hours': '0:00', 'scheduled_work': '0:00',
                'statutory_inner_overtime': '0:00', 'statutory_outer_overtime': '0:00',
                'late_night_work': '0:00', 'holiday_work': '0:00', 'late_night_holiday_work': '0:00'
            }

        # 実働時間の計算
        if end_td < start_td:
            total_duration = (timedelta(hours=24) - start_td) + end_td
        else:
            total_duration = end_td - start_td
        actual_work_duration = max(timedelta(0), total_duration - break_td - night_break_td)

        # 深夜労働時間の計算
        late_night_duration = self._calculate_late_night_duration(start_td, end_td)
        late_night_work_duration = max(timedelta(0), late_night_duration - night_break_td)

        # 結果を格納する辞書
        result = {
            'working_hours': actual_work_duration, 'scheduled_work': timedelta(0),
            'statutory_inner_overtime': timedelta(0), 'statutory_outer_overtime': timedelta(0),
            'late_night_work': timedelta(0), 'holiday_work': timedelta(0), 'late_night_holiday_work': timedelta(0),
        }

        # 休日かどうかで処理を分岐
        is_holiday = bool(record.get('holiday_type')) or record.get('is_holiday_from_calendar', False)

        if is_holiday:
            result['holiday_work'] = actual_work_duration
            result['late_night_holiday_work'] = late_night_work_duration
        else:
            # 平日の時間計算
            scheduled_work = min(actual_work_duration, STANDARD_WORK_HOURS)
            total_overtime = max(timedelta(0), actual_work_duration - scheduled_work)

            # 法定時間内残業と法定時間外残業の計算
            inner_overtime_limit = LEGAL_WORK_HOURS - STANDARD_WORK_HOURS
            statutory_inner_overtime = min(total_overtime, inner_overtime_limit)
            statutory_outer_overtime = max(timedelta(0), total_overtime - statutory_inner_overtime)

            result['scheduled_work'] = scheduled_work
            result['statutory_inner_overtime'] = statutory_inner_overtime
            result['statutory_outer_overtime'] = statutory_outer_overtime
            result['late_night_work'] = late_night_work_duration

        return {k: self._format_timedelta(v) for k, v in result.items()}

    def calculate_monthly_summary(self, daily_records: list[dict]) -> dict:
        """
        日次の勤怠記録リストから、月次の集計値を計算する。
        """
        day_counts = {
            'working_days': 0, 'absent_days': 0, 'holiday_work_days': 0,
            'paid_holidays': 0.0, 'compensatory_holidays': 0.0, 'transfer_holidays': 0.0,
            'late_days': 0, 'early_leave_days': 0, 'flex_days': 0, 'direct_travel_days': 0,
            'statutory_holidays': 0, 'scheduled_holidays': 0, 'special_holidays': 0,
        }
        # 時間集計用のキーを日次サマリーのキーと一致させる
        time_totals = {
            'working_hours': timedelta(0), 'scheduled_work': timedelta(0),
            'statutory_inner_overtime': timedelta(0), 'statutory_outer_overtime': timedelta(0),
            'late_night_work': timedelta(0), 'holiday_work': timedelta(0), 'late_night_holiday_work': timedelta(0),
        }

        for record in daily_records:
            daily_summary = record.get('daily_summary', {})
            # 日次サマリーの各時間を加算
            for key, time_str in daily_summary.items():
                if key in time_totals:
                    time_totals[key] += self._parse_time_to_timedelta(time_str)

            # 日数関連の集計
            if self._parse_time_to_timedelta(daily_summary.get('working_hours')) > timedelta(0):
                day_counts['working_days'] += 1
            if self._parse_time_to_timedelta(daily_summary.get('holiday_work')) > timedelta(0):
                day_counts['holiday_work_days'] += 1

            att_type = record.get('attendance_type')
            day_to_add = 0.5 if att_type in HALF_DAY_ATTENDANCE_TYPES else 1.0

            if att_type == '欠勤': day_counts['absent_days'] += day_to_add
            elif att_type == '有休' or att_type in HALF_DAY_ATTENDANCE_TYPES: day_counts['paid_holidays'] += day_to_add
            elif att_type == '代休': day_counts['compensatory_holidays'] += day_to_add
            elif att_type == '振休': day_counts['transfer_holidays'] += day_to_add
            elif att_type == '遅刻': day_counts['late_days'] += 1
            elif att_type == '早退': day_counts['early_leave_days'] += 1
            elif att_type == 'フレックス': day_counts['flex_days'] += 1
            elif att_type == '直行/直帰': day_counts['direct_travel_days'] += 1

            hol_type = record.get('holiday_type')
            if hol_type == '法定休': day_counts['statutory_holidays'] += 1
            elif hol_type == '所定休': day_counts['scheduled_holidays'] += 1
            elif hol_type == '特別休': day_counts['special_holidays'] += 1

        # APIのレスポンスに合わせてキーに 'total_' を付与
        formatted_time_totals = {f"total_{key}": self._format_timedelta(td) for key, td in time_totals.items()}

        return {**day_counts, **formatted_time_totals}