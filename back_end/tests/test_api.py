import pytest
from datetime import datetime

class TestWorkRecordsAPI:
    def test_save_and_get_work_record(self, auth_client):
        # 1. Save a work record
        # Employee ID 1 is the one created in conftest.py
        data = {
            'employee_id': 1,
            'year': 2025,
            'month': 4,
            'records': [
                {
                    'day': 1,
                    'start_time': '09:00',
                    'end_time': '18:00',
                    'break_time': '01:00',
                    'work_content': 'Development'
                }
            ],
            'special_notes': 'Test notes',
            'monthly_summary': {}
        }

        response = auth_client.post('/api/work_records', json=data)
        assert response.status_code == 200
        assert response.json['message'] == '保存しました'

        # 2. Get the work records
        response = auth_client.get('/api/work_records/1/2025/4')
        assert response.status_code == 200

        result = response.json
        assert result['special_notes'] == 'Test notes'

        # Find the record for day 1
        day1_record = None
        for record in result['records']:
            if record['day'] == 1:
                day1_record = record
                break

        assert day1_record is not None
        assert day1_record['start_time'] == '09:00'
        assert day1_record['end_time'] == '18:00'

        # 3. Verify that daily_summary is calculated correctly (Integration with AttendanceCalculator)
        monthly_summary = result['monthly_summary']
        assert monthly_summary['total_working_hours'] == '8:00'
        assert monthly_summary['working_days'] == 1

    def test_access_other_user_data_denied(self, auth_client):
        # User 1 tries to access User 2's data
        response = auth_client.get('/api/work_records/2/2025/4')
        # Should be 403 Forbidden
        assert response.status_code == 403

    def test_login_failure(self, client):
        response = client.post('/api/login', json={
            'employee_id': 1,
            'password': 'wrong_password'
        })
        assert response.status_code == 401
