import time
from playwright.sync_api import sync_playwright, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    try:
        # 1. アプリケーションを開く
        page.goto("http://localhost:5173")
        page.wait_for_load_state('networkidle')

        # 2. 「請求先・案件別集計表」と「特記事項」の順序を確認
        # 請求先・案件別集計表が先にあるべき

        # DOMの順番を取得
        # 特記事項のヘッダーまたはエリア
        summary_header = page.locator("h2", has_text="請求先・案件別集計表")
        notes_header = page.locator("label", has_text="特記事項")

        # bounding boxのy座標を比較
        summary_box = summary_header.bounding_box()
        notes_box = notes_header.bounding_box()

        if summary_box and notes_box:
            print(f"Summary Y: {summary_box['y']}, Notes Y: {notes_box['y']}")
            if summary_box['y'] < notes_box['y']:
                print("Success: Summary table is above Special Notes.")
            else:
                print("Failure: Summary table is NOT above Special Notes.")
                raise Exception("Layout order is incorrect")
        else:
            print("Could not find elements to verify layout.")

        # スクリーンショット
        page.screenshot(path="verification/layout_verification.png", full_page=True)

    except Exception as e:
        print(f"Error: {e}")
    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)
