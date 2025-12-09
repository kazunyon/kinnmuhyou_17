from playwright.sync_api import sync_playwright, expect
import time

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    page.goto("http://localhost:5173/")

    page.fill("input[type='number']", "1")
    page.fill("input[type='password']", "123")

    page.get_by_role("button", name="ログイン").click()

    expect(page.locator("h1", has_text="作業報告書").first).to_be_visible()

    # 複数のテーブルがあるかもしれないので、最初のtfootを指定
    footer = page.locator("tfoot").first

    # footerが画面内に表示されるまでスクロール
    footer.scroll_into_view_if_needed()
    expect(footer).to_be_visible()

    expect(footer).to_contain_text("所定内:")
    expect(footer).to_contain_text("法定内残業:")
    expect(footer).to_contain_text("法定外残業:")
    expect(footer).to_contain_text("深夜労働:")
    expect(footer).to_contain_text("休日労働:")

    time.sleep(2)
    page.screenshot(path="verification/summary_verification.png", full_page=True)

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
