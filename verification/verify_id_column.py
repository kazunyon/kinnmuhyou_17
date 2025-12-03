
import time
from playwright.sync_api import sync_playwright

def verify_id_column():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        try:
            print("Accessing application...")
            page.goto("http://localhost:5173")

            # Login
            print("Logging in as Manager (ID: 2)...")
            page.wait_for_selector('#employeeId', timeout=5000)
            page.fill('#employeeId', '2')
            page.fill('#password', '123')
            page.click('button:has-text("ログイン")')

            # Wait for dashboard
            page.wait_for_selector('text=ログイン中', timeout=10000)
            print("Login successful.")

            # Open Approval Status Modal
            print("Opening Approval Status Modal...")
            page.click('button:has-text("承認状況表")')

            # Wait for modal
            # Use specific selector for the modal to ensure we are looking inside it
            modal_selector = '.ReactModal__Content'
            page.wait_for_selector(modal_selector, timeout=5000)
            print("Modal opened.")

            # Wait for table inside modal
            time.sleep(2)

            # Verify ID Header
            print("Verifying ID header...")
            # Scope locator to the modal
            modal = page.locator(modal_selector)
            headers = modal.locator('thead th')

            # Debug: print all headers found
            count = headers.count()
            print(f"Found {count} headers inside modal.")
            for i in range(count):
                print(f"Header {i}: {headers.nth(i).inner_text()}")

            if count == 0:
                print("FAILURE: No headers found inside modal.")
                exit(1)

            first_header = headers.nth(0)
            header_text = first_header.inner_text()

            if "ID" in header_text:
                print("SUCCESS: ID header found.")
            else:
                print(f"FAILURE: Expected 'ID' in first header, but found '{header_text}'")
                exit(1)

            # Verify ID Data Cell
            print("Verifying ID data in rows...")
            # Scope to modal tbody
            rows = modal.locator('tbody tr')
            row_count = rows.count()
            print(f"Found {row_count} rows in modal table.")

            if row_count == 0:
                print("WARNING: No data rows found in modal.")
            else:
                first_row_cell = rows.nth(0).locator('td').nth(0)
                cell_text = first_row_cell.inner_text()
                print(f"First cell text: '{cell_text}'")

                # It should be a number (employee ID)
                if cell_text.strip().isdigit():
                     print(f"SUCCESS: ID data '{cell_text}' found in first column.")
                else:
                     # Check if it's the "No data" message
                     if "該当するデータがありません" in cell_text:
                         print("INFO: No data available to verify ID content, but header was verified.")
                     else:
                         print(f"FAILURE: Expected number in first cell, but found '{cell_text}'")
                         exit(1)

            page.screenshot(path="verification/id_column_verified.png")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error_verify_id.png")
            exit(1)
        finally:
            browser.close()

if __name__ == "__main__":
    verify_id_column()
