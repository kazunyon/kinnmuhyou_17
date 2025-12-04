from playwright.sync_api import Page, expect, sync_playwright
import time

def verify_textarea(page: Page):
    # 1. Login
    page.goto("http://localhost:5173")

    # Check if login screen is present
    if page.get_by_role("button", name="ログイン").is_visible():
        print("Logging in...")
        page.fill("#employeeId", "1")
        page.fill("#password", "123")
        page.click("button:has-text('ログイン')")

    # Wait for the report screen to load
    page.wait_for_selector("text=作業報告書")
    print("Logged in successfully.")

    # 2. Open Daily Report Modal
    # Find a date cell (e.g., "1") and double click it
    print("Opening Daily Report Modal...")
    # Using a selector that targets the first day cell in the table body
    # Assuming day 1 is available and visible
    # ReportTable renders day in the first column.

    # We need to target a row. Let's pick the first row in tbody.
    first_row = page.locator("tbody tr").first
    first_row.dblclick()

    # Expect the modal header
    expect(page.locator("h2:has-text('日報入力')")).to_be_visible()
    print("Daily Report Modal opened.")

    # 3. Add a detail row
    print("Adding a detail row...")
    page.click("button:has-text('+ 行追加')")

    # 4. Check the textarea
    print("Checking textarea...")
    # The textarea is in the third column of the detail table (index 2)
    # But checking by placeholder or class is easier if unique
    # We replaced input with AutoResizeTextarea. It has class 'resize-none'
    textarea = page.locator("textarea.resize-none").first
    expect(textarea).to_be_visible()

    # Check initial height (should be small, around 34px)
    box = textarea.bounding_box()
    initial_height = box['height']
    print(f"Initial height: {initial_height}")

    # 5. Type multiple lines
    print("Typing multiple lines...")
    text_content = "Line 1\nLine 2\nLine 3\nLine 4\nLine 5"
    textarea.fill(text_content)

    # Wait a bit for effect
    time.sleep(1)

    # Check new height
    box_after = textarea.bounding_box()
    final_height = box_after['height']
    print(f"Final height: {final_height}")

    if final_height > initial_height:
        print("SUCCESS: Textarea expanded.")
    else:
        print("FAILURE: Textarea did not expand.")

    # Take screenshot
    page.screenshot(path="verification/verification.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_textarea(page)
        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error.png")
        finally:
            browser.close()
