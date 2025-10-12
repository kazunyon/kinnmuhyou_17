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
    """勤怠データの日次および月次の集計を計算するクラス。

    このクラスは、日々の勤務記録から労働時間、残業時間、深夜労働などを計算し、
    月次の集計値（総労働時間、各種休暇日数など）を算出する機能を提供します。
    """

    def _parse_time_to_timedelta(self, time_str: str | None) -> timedelta:
        """'HH:MM'形式の時間文字列をtimedeltaオブジェクトに変換します。

        24:00を超える形式（例: '24:30'）にも対応します。
        文字列がNoneまたは不正な形式の場合は、timedelta(0)を返します。

        Args:
            time_str (str | None): 'HH:MM'形式の時間文字列。

        Returns:
            timedelta: 変換された時間量。
        """
        if not time_str:
            return timedelta(0)
        try:
            # '24:xx' のような形式を翌日の '00:xx' として扱う
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
        """timedeltaオブジェクトを 'HH:MM' 形式の文字列にフォーマットします。

        Args:
            td (timedelta): フォーマットするtimedeltaオブジェクト。

        Returns:
            str: 'HH:MM'形式の文字列。tdが負数または無効な場合は"0:00"を返します。
        """
        if not isinstance(td, timedelta) or td.total_seconds() < 0:
            return "0:00"
        total_seconds = int(td.total_seconds())
        hours = total_seconds // 3600
        minutes = (total_seconds % 3600) // 60
        return f"{hours}:{minutes:02d}"

    def _calculate_late_night_duration(self, start_td: timedelta, end_td: timedelta) -> timedelta:
        """勤務時間内の深夜労働時間（22:00〜翌5:00）を計算します。

        日をまたぐ勤務（例: 18:00〜翌6:00）にも対応します。

        Args:
            start_td (timedelta): 勤務開始時刻を表すtimedelta。
            end_td (timedelta): 勤務終了時刻を表すtimedelta。

        Returns:
            timedelta: 計算された深夜労働時間の合計。
        """
        work_start_s = start_td.total_seconds()
        work_end_s = end_td.total_seconds()
        # 終了時刻が開始時刻より小さい場合、日またぎと判断
        if work_end_s < work_start_s:
            work_end_s += 24 * 3600

        # 深夜時間帯を秒単位で定義（日またぎ対応のため48時間分を考慮）
        ln_intervals = [
            (0 * 3600, 5 * 3600),          # 00:00 - 05:00
            (22 * 3600, 24 * 3600),         # 22:00 - 24:00
            (24 * 3600, (24 + 5) * 3600)    # 翌日の 00:00 - 05:00
        ]

        total_ln_seconds = 0
        for ln_start, ln_end in ln_intervals:
            # 勤務時間と深夜時間帯の重複部分を計算
            overlap_start = max(work_start_s, ln_start)
            overlap_end = min(work_end_s, ln_end)
            overlap_duration = max(0, overlap_end - overlap_start)
            total_ln_seconds += overlap_duration

        return timedelta(seconds=total_ln_seconds)

    def calculate_daily_summary(self, record: dict) -> dict:
        """1日分の勤務記録から、各項目の集計値を計算します。

        実働時間、所定内労働、法定内・外残業、深夜労働、休日労働などを計算し、
        'HH:MM'形式の文字列で返します。

        Args:
            record (dict): 1日分の勤務記録データを含む辞書。
                {
                    'start_time': str, 'end_time': str, 'break_time': str,
                    'night_break_time': str, 'holiday_type': str,
                    'is_holiday_from_calendar': bool
                }

        Returns:
            dict: 計算された日次サマリー。各値は 'HH:MM' 形式。
                {
                    'working_hours': str, 'scheduled_work': str,
                    'statutory_inner_overtime': str, 'statutory_outer_overtime': str,
                    'late_night_work': str, 'holiday_work': str,
                    'late_night_holiday_work': str
                }
        """
        start_td = self._parse_time_to_timedelta(record.get('start_time'))
        end_td = self._parse_time_to_timedelta(record.get('end_time'))
        break_td = self._parse_time_to_timedelta(record.get('break_time'))
        night_break_td = self._parse_time_to_timedelta(record.get('night_break_time'))

        if start_td == timedelta(0) and end_td == timedelta(0):
            return {
                'working_hours': '0:00', 'scheduled_work': '0:00',
                'statutory_inner_overtime': '0:00', 'statutory_outer_overtime': '0:00',
                'late_night_work': '0:00', 'holiday_work': '0:00', 'late_night_holiday_work': '0:00'
            }

        if end_td < start_td:
            total_duration = (timedelta(hours=24) - start_td) + end_td
        else:
            total_duration = end_td - start_td
        actual_work_duration = max(timedelta(0), total_duration - break_td - night_break_td)

        late_night_duration = self._calculate_late_night_duration(start_td, end_td)
        late_night_work_duration = max(timedelta(0), late_night_duration - night_break_td)

        result = {
            'working_hours': actual_work_duration, 'scheduled_work': timedelta(0),
            'statutory_inner_overtime': timedelta(0), 'statutory_outer_overtime': timedelta(0),
            'late_night_work': timedelta(0), 'holiday_work': timedelta(0), 'late_night_holiday_work': timedelta(0),
        }

        is_holiday = bool(record.get('holiday_type')) or record.get('is_holiday_from_calendar', False)

        if is_holiday:
            result['holiday_work'] = actual_work_duration
            result['late_night_holiday_work'] = late_night_work_duration
        else:
            scheduled_work = min(actual_work_duration, STANDARD_WORK_HOURS)
            total_overtime = max(timedelta(0), actual_work_duration - scheduled_work)

            # 法定時間(8h)と所定時間(8h)が同じ場合、法定内残業は発生しない
            inner_overtime_limit = LEGAL_WORK_HOURS - STANDARD_WORK_HOURS
            statutory_inner_overtime = min(total_overtime, inner_overtime_limit)
            statutory_outer_overtime = max(timedelta(0), total_overtime - statutory_inner_overtime)

            result['scheduled_work'] = scheduled_work
            result['statutory_inner_overtime'] = statutory_inner_overtime
            result['statutory_outer_overtime'] = statutory_outer_overtime
            result['late_night_work'] = late_night_work_duration

        return {k: self._format_timedelta(v) for k, v in result.items()}

    def calculate_monthly_summary(self, daily_records: list[dict]) -> dict:
        """日次の勤怠記録リストから、月次の集計値を計算します。

        総労働時間や各種残業時間の合計、および出勤日数、欠勤日数、各種休暇の
        取得日数などを集計します。

        Args:
            daily_records (list[dict]): 1ヶ月分の日次記録データのリスト。
                各要素は `calculate_daily_summary` の入力と同じ構造を持つ想定。

        Returns:
            dict: 月次の集計結果。時間合計は 'total_' プレフィックス付きで
                  'HH:MM' 形式、日数は数値または浮動小数点数。
        """
        day_counts = {
            'working_days': 0, 'absent_days': 0.0, 'holiday_work_days': 0,
            'paid_holidays': 0.0, 'compensatory_holidays': 0.0, 'transfer_holidays': 0.0,
            'late_days': 0, 'early_leave_days': 0, 'flex_days': 0, 'direct_travel_days': 0,
            'statutory_holidays': 0, 'scheduled_holidays': 0, 'special_holidays': 0,
        }
        time_totals = {
            'working_hours': timedelta(0), 'scheduled_work': timedelta(0),
            'statutory_inner_overtime': timedelta(0), 'statutory_outer_overtime': timedelta(0),
            'late_night_work': timedelta(0), 'holiday_work': timedelta(0), 'late_night_holiday_work': timedelta(0),
        }

        for record in daily_records:
            daily_summary = record.get('daily_summary', {})
            for key, time_str in daily_summary.items():
                if key in time_totals:
                    time_totals[key] += self._parse_time_to_timedelta(time_str)

            if self._parse_time_to_timedelta(daily_summary.get('working_hours', '0:00')) > timedelta(0):
                day_counts['working_days'] += 1
            if self._parse_time_to_timedelta(daily_summary.get('holiday_work', '0:00')) > timedelta(0):
                day_counts['holiday_work_days'] += 1

            att_type = record.get('attendance_type')
            # 半休の場合は0.5日として加算
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

        formatted_time_totals = {f"total_{key}": self._format_timedelta(td) for key, td in time_totals.items()}

        return {**day_counts, **formatted_time_totals}
