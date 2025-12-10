import pytest
import os
import sys
import tempfile
import sqlite3

# Add backend to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app, get_db
import app as flask_app_module

@pytest.fixture
def client():
    # Create a temporary file for the database
    db_fd, db_path = tempfile.mkstemp()

    # Patch the DATABASE variable in app module
    flask_app_module.DATABASE = db_path

    app.config['TESTING'] = True

    # Initialize the database
    with app.app_context():
        # We need to run the schema.sql
        with sqlite3.connect(db_path) as db:
            with open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'schema.sql'), 'r', encoding='utf-8') as f:
                db.executescript(f.read())

            # Insert a dummy user for testing
            from werkzeug.security import generate_password_hash

            # Insert a company first
            db.execute("INSERT INTO companies (company_id, company_name) VALUES (?, ?)", (1, 'Test Company'))

            db.execute(
                "INSERT INTO employees (employee_id, company_id, employee_name, password, role, retirement_flag) VALUES (?, ?, ?, ?, ?, ?)",
                (1, 1, 'Test User', generate_password_hash('password'), 'employee', 0)
            )
            db.commit()

    with app.test_client() as client:
        with app.app_context():
            yield client

    # Cleanup
    os.close(db_fd)
    os.unlink(db_path)

@pytest.fixture
def auth_client(client):
    # Log in
    client.post('/api/login', json={
        'employee_id': 1,
        'password': 'password'
    })
    return client
