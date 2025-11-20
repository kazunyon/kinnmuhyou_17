import time
from playwright.sync_api import sync_playwright, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    try:
        page.goto("http://localhost:5173")
        page.wait_for_load_state('networkidle')

        # 1. 別の社員（データがない社員）に切り替えるなどして、データなし状態を確認
        # あるいは、現在の社員の別の月（未来の月など）に移動する

        # 2026年1月に移動
        page.locator("header select").first.select_option(value="2026")
        page.locator("header select").nth(1).select_option(label="1月")

        # ロード待ち
        time.sleep(1)

        # 2. 「集計データはありません」が表示されているか確認
        page.wait_for_selector("text=請求先・案件別集計表")
        expect(page.get_by_text("集計データはありません")).to_be_visible()

        # スクリーンショット
        page.screenshot(path="verification/empty_summary.png", full_page=True)
        print("Verification successful")

    except Exception as e:
        print(f"Error: {e}")
        page.screenshot(path="verification/empty_summary_error.png")
    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)
