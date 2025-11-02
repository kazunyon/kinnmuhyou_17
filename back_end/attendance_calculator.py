from datetime import datetime, timedelta, time
from typing import Dict, Any, List, Optional

# --- 定数定義 ---
STANDARD_WORK_HOURS = timedelta(hours=8)
LEGAL_WORK_HOURS = timedelta(hours=8)
LATE_NIGHT_START_TIME = time(22, 0)
LATE_NIGHT_END_TIME = time(5, 0)
HALF_DAY_ATTENDANCE_TYPES = ['半休', '半有休', 'AM半休', 'PM半休']


class AttendanceCalculator:
    """勤怠データの日次および月次の集計を計算するクラス。

    日々の勤務記録から労働時間、残業時間、深夜労働などを計算し、
    月次の集計値（総労働時間、各種休暇日数など）を算出する機能を提供します。
    """

    def _parse_time_to_timedelta(self, time_str: Optional[str]) -> timedelta:
        """'HH:MM'形式の時間文字列をtimedeltaオブジェクトに変換します。

        24:00を超える形式（例: '24:30'）にも対応します。

        Args:
            time_str: 'HH:MM'形式の時間文字列。Noneも許容。

        Returns:
            変換された時間量。文字列がNoneまたは不正な形式の場合はtimedelta(0)。
        """
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
        """timedeltaオブジェクトを 'HH:MM' 形式の文字列にフォーマットします。

        Args:
            td: フォーマットするtimedeltaオブジェクト。

        Returns:
            'HH:MM'形式の文字列。tdが負数または無効な場合は"0:00"。
        """
        if not isinstance(td, timedelta) or td.total_seconds() < 0:
            return "0:00"
        total_seconds = int(td.total_seconds())
        hours = total_seconds // 3600
        minutes = (total_seconds % 3600) // 60
        return f"{hours}:{minutes:02d}"

    def _calculate_late_night_duration(self, start_td: timedelta, end_td: timedelta) -> timedelta:
        """勤務時間内の深夜労働時間（22:00〜翌5:00）を計算します。

        日をまたぐ勤務にも対応します。

        Args:
            start_td: 勤務開始時刻を表すtimedelta。
            end_td: 勤務終了時刻を表すtimedelta。

        Returns:
            計算された深夜労働時間の合計。
        """
        work_start_s = start_td.total_seconds()
        work_end_s = end_td.total_seconds()
        if work_end_s < work_start_s:
            work_end_s += 24 * 3600

        ln_intervals = [(0, 5 * 3600), (22 * 3600, 24 * 3600), (24 * 3600, 29 * 3600)]
        total_ln_seconds = 0
        for ln_start, ln_end in ln_intervals:
            overlap_start = max(work_start_s, ln_start)
            overlap_end = min(work_end_s, ln_end)
            total_ln_seconds += max(0, overlap_end - overlap_start)
        return timedelta(seconds=total_ln_seconds)

    def calculate_daily_summary(self, record: Dict[str, Any]) -> Dict[str, str]:
        """1日分の勤務記録から、各項目の集計値を計算します。

        Args:
            record: 1日分の勤務記録データを含む辞書。以下のキーを持つ想定:
                'start_time' (str): 勤務開始時刻 'HH:MM'
                'end_time' (str): 勤務終了時刻 'HH:MM'
                'break_time' (str): 休憩時間 'HH:MM'
                'night_break_time' (str): 深夜休憩時間 'HH:MM'
                'holiday_type' (str): 休日種別
                'is_holiday_from_calendar' (bool): カレンダー上の休日か否か

        Returns:
            計算された日次サマリー。各値は 'HH:MM' 形式の文字列。
        """
        start_td = self._parse_time_to_timedelta(record.get('start_time'))
        end_td = self._parse_time_to_timedelta(record.get('end_time'))
        break_td = self._parse_time_to_timedelta(record.get('break_time'))
        night_break_td = self._parse_time_to_timedelta(record.get('night_break_time'))

        if start_td == timedelta(0) and end_td == timedelta(0):
            return {k: '0:00' for k in ['working_hours', 'scheduled_work', 'statutory_inner_overtime',
                                         'statutory_outer_overtime', 'late_night_work', 'holiday_work',
                                         'late_night_holiday_work']}

        total_duration = (end_td - start_td) if end_td >= start_td else (timedelta(hours=24) - start_td + end_td)
        actual_work = max(timedelta(0), total_duration - break_td - night_break_td)
        late_night_raw = self._calculate_late_night_duration(start_td, end_td)
        late_night_work = max(timedelta(0), late_night_raw - night_break_td)

        result = {'working_hours': actual_work, 'scheduled_work': timedelta(0), 'statutory_inner_overtime': timedelta(0),
                  'statutory_outer_overtime': timedelta(0), 'late_night_work': timedelta(0), 'holiday_work': timedelta(0),
                  'late_night_holiday_work': timedelta(0)}

        is_holiday = record.get('holiday_type') or record.get('is_holiday_from_calendar', False)

        if is_holiday:
            result['holiday_work'] = actual_work
            result['late_night_holiday_work'] = late_night_work
        else:
            result['scheduled_work'] = min(actual_work, STANDARD_WORK_HOURS)
            overtime = max(timedelta(0), actual_work - result['scheduled_work'])
            inner_overtime_limit = max(timedelta(0), LEGAL_WORK_HOURS - STANDARD_WORK_HOURS)
            result['statutory_inner_overtime'] = min(overtime, inner_overtime_limit)
            result['statutory_outer_overtime'] = max(timedelta(0), overtime - result['statutory_inner_overtime'])
            result['late_night_work'] = late_night_work

        return {k: self._format_timedelta(v) for k, v in result.items()}

    def calculate_monthly_summary(self, daily_records: List[Dict[str, Any]]) -> Dict[str, Any]:
        """日次の勤怠記録リストから、月次の集計値を計算します。

        総労働時間、残業時間、出勤日数、各種休暇日数などを集計します。

        Args:
            daily_records: 1ヶ月分の日次記録データリスト。各要素は
                `calculate_daily_summary`の入力`record`と同じ構造に加え、
                'daily_summary'と'attendance_type'キーを持つ想定。

        Returns:
            月次の集計結果。時間合計は'HH:MM'形式、日数は数値。
        """
        day_counts = {'working_days': 0, 'absent_days': 0.0, 'holiday_work_days': 0, 'paid_holidays': 0.0,
                      'compensatory_holidays': 0.0, 'transfer_holidays': 0.0, 'late_days': 0, 'early_leave_days': 0,
                      'flex_days': 0, 'direct_travel_days': 0, 'statutory_holidays': 0, 'scheduled_holidays': 0,
                      'special_holidays': 0}
        time_totals = {k: timedelta(0) for k in ['working_hours', 'scheduled_work', 'statutory_inner_overtime',
                                                 'statutory_outer_overtime', 'late_night_work', 'holiday_work',
                                                 'late_night_holiday_work']}

        for record in daily_records:
            summary = record.get('daily_summary', {})
            for key in time_totals:
                time_totals[key] += self._parse_time_to_timedelta(summary.get(key, '0:00'))

            if self._parse_time_to_timedelta(summary.get('working_hours', '0:00')) > timedelta(0):
                day_counts['working_days'] += 1
            if self._parse_time_to_timedelta(summary.get('holiday_work', '0:00')) > timedelta(0):
                day_counts['holiday_work_days'] += 1

            att_type = record.get('attendance_type')
            day_to_add = 0.5 if att_type in HALF_DAY_ATTENDANCE_TYPES else 1.0

            type_map = {'欠勤': 'absent_days', '有休': 'paid_holidays', '代休': 'compensatory_holidays',
                        '振休': 'transfer_holidays', '遅刻': 'late_days', '早退': 'early_leave_days',
                        'フレックス': 'flex_days', '直行/直帰': 'direct_travel_days'}
            if att_type in type_map:
                day_counts[type_map[att_type]] += day_to_add
            elif att_type in HALF_DAY_ATTENDANCE_TYPES: # 半有休など
                day_counts['paid_holidays'] += day_to_add

            hol_type = record.get('holiday_type')
            hol_map = {'法定休': 'statutory_holidays', '所定休': 'scheduled_holidays', '特別休': 'special_holidays'}
            if hol_type in hol_map:
                day_counts[hol_map[hol_type]] += 1

        formatted_times = {f"total_{k}": self._format_timedelta(v) for k, v in time_totals.items()}
        return {**day_counts, **formatted_times}
