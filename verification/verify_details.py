from playwright.sync_api import sync_playwright, expect
import time
import re

def verify_work_details(page):
    # ログイン
    page.goto('http://localhost:5173')

    # ログインフォーム入力
    page.fill('input#employeeId', '1')
    page.fill('input#password', '123')
    page.click('button[type="submit"]')

    # メイン画面待機
    page.wait_for_selector('h1:has-text("作業報告書")')

    # データロード待ち
    time.sleep(2)

    # 最初の行（1日）を探す
    first_row = page.locator('table tbody tr').first

    # 行をクリックして選択状態にする
    first_row.click()

    # 選択されたことを確認 (背景色が黄色くなっているはず)
    # 正規表現オブジェクトを渡す
    expect(first_row).to_have_class(re.compile(r"bg-yellow-50"))

    # ヘッダーにある「追加」ボタンをクリック
    header_add_btn = page.locator('table thead th button:has-text("追加")')
    header_add_btn.click()

    # 詳細行が追加されたことを確認
    detail_row = first_row.locator('td:nth-child(4) div.flex').first
    detail_row.wait_for(state="visible")

    # 取引先を選択
    client_select = detail_row.locator('select').nth(0)
    client_select.select_option(index=1)

    # 案件を選択
    project_select = detail_row.locator('select').nth(1)
    project_select.select_option(index=1)

    # 作業詳細を入力
    desc_input = detail_row.locator('input[type="text"]')
    desc_input.fill('検証作業')

    # 時間を入力 (02:00)
    time_input = detail_row.locator('input[type="time"]')
    time_input.fill('02:00')

    # フォーカスを外す
    page.click('h1')
    time.sleep(0.5)

    # 合計作業時間（左端）が 02:00 になっているか確認
    total_time_cell = first_row.locator('td:nth-child(3)')
    expect(total_time_cell).to_contain_text("02:00")

    # スクリーンショット
    page.screenshot(path='/app/verification/verification.png')

if __name__ == '__main__':
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_work_details(page)
            print("Verification successful")
        except Exception as e:
            print(f"Verification failed: {e}")
            page.screenshot(path='/app/verification/verification_failed.png')
        finally:
            browser.close()
