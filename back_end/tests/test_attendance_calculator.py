import sys
import os
from datetime import timedelta
import pytest

# Add the parent directory to sys.path to allow importing attendance_calculator
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from attendance_calculator import AttendanceCalculator

class TestAttendanceCalculator:
    def setup_method(self):
        self.calc = AttendanceCalculator()

    def test_parse_time_to_timedelta_valid(self):
        assert self.calc._parse_time_to_timedelta("09:00") == timedelta(hours=9)
        assert self.calc._parse_time_to_timedelta("09:30") == timedelta(hours=9, minutes=30)
        assert self.calc._parse_time_to_timedelta("00:00") == timedelta(hours=0)

    def test_parse_time_to_timedelta_24_hour_notation(self):
        # 24:30 -> 24h 30m
        assert self.calc._parse_time_to_timedelta("24:30") == timedelta(hours=24, minutes=30)
        assert self.calc._parse_time_to_timedelta("25:00") == timedelta(hours=25)

    def test_parse_time_to_timedelta_invalid(self):
        assert self.calc._parse_time_to_timedelta(None) == timedelta(0)
        assert self.calc._parse_time_to_timedelta("") == timedelta(0)
        assert self.calc._parse_time_to_timedelta("invalid") == timedelta(0)
        assert self.calc._parse_time_to_timedelta("2400") == timedelta(0)

    def test_format_timedelta(self):
        assert self.calc._format_timedelta(timedelta(hours=9, minutes=30)) == "9:30"
        assert self.calc._format_timedelta(timedelta(hours=0)) == "0:00"
        assert self.calc._format_timedelta(timedelta(hours=25)) == "25:00"

        # Negative or invalid
        assert self.calc._format_timedelta(timedelta(hours=-1)) == "0:00"
        assert self.calc._format_timedelta("not a timedelta") == "0:00"

    def test_calculate_late_night_duration_standard(self):
        # 18:00 - 23:00 -> 5h total. Late night: 22:00-23:00 (1h)
        start = timedelta(hours=18)
        end = timedelta(hours=23)
        assert self.calc._calculate_late_night_duration(start, end) == timedelta(hours=1)

    def test_calculate_late_night_duration_cross_day(self):
        # 18:00 - 05:00 (next day) -> 11h total.
        # Late night: 22:00-24:00 (2h) + 00:00-05:00 (5h) = 7h
        start = timedelta(hours=18)
        end = timedelta(hours=5) # This will be treated as next day in logic if end < start
        assert self.calc._calculate_late_night_duration(start, end) == timedelta(hours=7)

    def test_calculate_late_night_duration_full_night(self):
        # 22:00 - 05:00 -> 7h
        start = timedelta(hours=22)
        end = timedelta(hours=29) # 29:00 = 05:00 next day
        assert self.calc._calculate_late_night_duration(start, end) == timedelta(hours=7)

    def test_calculate_daily_summary_normal_workday(self):
        # 9:00 - 18:00, 1h break. 8h work. No overtime.
        record = {
            'start_time': '09:00',
            'end_time': '18:00',
            'break_time': '01:00',
            'night_break_time': '00:00',
            'holiday_type': None,
            'is_holiday_from_calendar': False
        }
        summary = self.calc.calculate_daily_summary(record)
        assert summary['working_hours'] == '8:00'
        assert summary['scheduled_work'] == '8:00'
        assert summary['statutory_inner_overtime'] == '0:00'
        assert summary['statutory_outer_overtime'] == '0:00'
        assert summary['late_night_work'] == '0:00'
        assert summary['holiday_work'] == '0:00'

    def test_calculate_daily_summary_overtime(self):
        # 9:00 - 19:00, 1h break. 9h work. 8h scheduled, 1h overtime (outer statutory, since standard=legal=8h)
        # Note: STANDARD_WORK_HOURS=8, LEGAL_WORK_HOURS=8.
        # So all overtime is "statutory_outer_overtime" (legal overtime).
        # Inner overtime is 0.
        record = {
            'start_time': '09:00',
            'end_time': '19:00',
            'break_time': '01:00',
            'night_break_time': '00:00'
        }
        summary = self.calc.calculate_daily_summary(record)
        assert summary['working_hours'] == '9:00'
        assert summary['scheduled_work'] == '8:00'
        assert summary['statutory_inner_overtime'] == '0:00'
        assert summary['statutory_outer_overtime'] == '1:00'

    def test_calculate_daily_summary_late_night(self):
        # 14:00 - 23:00, 1h break. 8h work.
        # Late night: 22:00-23:00 -> 1h.
        record = {
            'start_time': '14:00',
            'end_time': '23:00',
            'break_time': '01:00',
            'night_break_time': '00:00'
        }
        summary = self.calc.calculate_daily_summary(record)
        assert summary['working_hours'] == '8:00'
        assert summary['late_night_work'] == '1:00'

    def test_calculate_daily_summary_holiday_work(self):
        # Holiday: 9:00 - 18:00, 1h break. 8h work.
        # All counts as holiday work.
        record = {
            'start_time': '09:00',
            'end_time': '18:00',
            'break_time': '01:00',
            'night_break_time': '00:00',
            'holiday_type': '法定休', # Statutory holiday
            'is_holiday_from_calendar': False
        }
        summary = self.calc.calculate_daily_summary(record)
        assert summary['working_hours'] == '8:00'
        assert summary['holiday_work'] == '8:00'
        assert summary['scheduled_work'] == '0:00' # No scheduled work on holiday
        assert summary['statutory_outer_overtime'] == '0:00' # It is counted as holiday work, not overtime?
        # Checking implementation: if is_holiday: result['holiday_work'] = actual_work_duration.
        # Overtime is NOT calculated for holidays in this logic (which is common).

    def test_calculate_monthly_summary(self):
        # 2 days.
        # Day 1: 8h work
        # Day 2: 9h work (1h overtime)
        # Day 3: Paid holiday (attendance_type='有休')
        records = [
            {
                'daily_summary': {
                    'working_hours': '8:00',
                    'scheduled_work': '8:00',
                    'statutory_outer_overtime': '0:00'
                },
                'attendance_type': '通常'
            },
            {
                'daily_summary': {
                    'working_hours': '9:00',
                    'scheduled_work': '8:00',
                    'statutory_outer_overtime': '1:00'
                },
                'attendance_type': '通常'
            },
            {
                'daily_summary': {},
                'attendance_type': '有休'
            }
        ]

        summary = self.calc.calculate_monthly_summary(records)

        assert summary['working_days'] == 2
        assert summary['paid_holidays'] == 1.0
        assert summary['total_working_hours'] == '17:00'
        assert summary['total_scheduled_work'] == '16:00'
        assert summary['total_statutory_outer_overtime'] == '1:00'
