
import time
from playwright.sync_api import sync_playwright

def verify_approval_status_modal():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        try:
            print("Accessing application...")
            page.goto("http://localhost:5173")
            time.sleep(2)

            print("Logging in as Manager (ID: 2)...")
            # Use specific selectors based on LoginScreen.jsx
            page.fill('#employeeId', '2')
            page.fill('#password', '123')
            page.click('button:has-text("ログイン")')

            # Wait for login to complete (check for logout button or welcome message)
            page.wait_for_selector('text=ログイン中', timeout=5000)
            print("Login successful.")

            time.sleep(1)
            page.screenshot(path="verification/after_login_manager.png")

            # Check for Approval Status Button
            approval_btn = page.locator('button:has-text("承認状況表")')
            if approval_btn.is_visible():
                print("Button found. Clicking...")
                approval_btn.click()

                # Wait for modal
                page.wait_for_selector('h2:has-text("承認状況表")', timeout=5000)
                print("Modal opened.")
                time.sleep(2) # Wait for data load

                # Take screenshot of the modal
                page.screenshot(path="verification/approval_status_modal.png")
                print("Screenshot taken.")

            else:
                print("Button NOT found!")
                page.screenshot(path="verification/button_missing.png")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error_retry.png")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_approval_status_modal()
