import re
from playwright.sync_api import sync_playwright, expect

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()

    try:
        # 1. アプリケーションのページに移動
        page.goto("http://localhost:5173/")

        # 2. テーブルの最初のデータ行をダブルクリックしてモーダルを開く
        #    tbody内の最初のtr要素をターゲットにする
        first_row = page.locator("tbody tr").first
        expect(first_row).to_be_visible(timeout=10000) # 10秒待機
        first_row.dblclick()

        # 3. モーダルが表示されるのを待つ
        #    モーダルのクラス名（react-modalのデフォルト）で要素を特定
        modal = page.locator(".ReactModal__Content")
        expect(modal).to_be_visible(timeout=5000)

        # 4. モーダルのスクリーンショットを撮影
        modal.screenshot(path="temp_verify/verification.png")

        print("スクリーンショットの撮影が完了しました。")

    except Exception as e:
        print(f"エラーが発生しました: {e}")
        page.screenshot(path="temp_verify/error.png")

    finally:
        browser.close()