from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()

    # API Mocking
    page.route("**/api/me", lambda route: route.fulfill(
        status=200,
        content_type="application/json",
        body='{"employee_id": 1, "employee_name": "Test Manager", "role": "manager"}'
    ))

    page.route("**/api/employees", lambda route: route.fulfill(
        status=200,
        content_type="application/json",
        body='[{"employee_id": 1, "employee_name": "Test Manager", "company_id": 1}]'
    ))

    page.route("**/api/companies", lambda route: route.fulfill(
        status=200,
        content_type="application/json",
        body='[{"company_id": 1, "company_name": "Test Company"}]'
    ))

    page.route("**/api/work_records/**", lambda route: route.fulfill(
        status=200,
        content_type="application/json",
        body='{"records": [], "status": "draft", "monthly_summary": {}}'
    ))

    page.route("**/api/holidays/**", lambda route: route.fulfill(
        status=200,
        content_type="application/json",
        body='{}'
    ))

    # Generate many employees to force scroll
    employees = []
    for i in range(1, 31):
        employees.append({
            "employee_id": i,
            "employee_name": f"Employee {i}",
            "department_name": "Dev",
            "company_id": 1,
            "employee_type": "正社員",
            "role": "employee",
            "retirement_flag": False
        })
    import json
    page.route("**/api/employees/all", lambda route: route.fulfill(
        status=200,
        content_type="application/json",
        body=json.dumps(employees)
    ))

    page.goto("http://localhost:8000")

    # Wait for loading
    page.wait_for_timeout(2000)

    # Click "マスター" button
    try:
        page.get_by_role("button", name="マスター").click()
    except Exception as e:
        print(f"Failed to click button: {e}")
        # print(page.content())

    # Wait for modal and employees to load
    page.wait_for_selector(".ReactModal__Content")

    # Wait a bit for rendering
    page.wait_for_timeout(1000)

    # Take screenshot
    page.screenshot(path="verification/master_modal_scroll.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
