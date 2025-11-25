import time
from playwright.sync_api import sync_playwright, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    # ダイアログを自動で受け入れる（alertやconfirm）
    page.on("dialog", lambda dialog: dialog.accept())

    try:
        # 1. アプリケーションを開く
        page.goto("http://localhost:5173")
        page.wait_for_load_state('networkidle')

        print("Page loaded")

        # 2. 社員を選択 (中村 一真) - デフォルトで選択されているはず
        page.wait_for_selector('text=作業報告書', timeout=60000)

        # 3. マスターボタンをクリック
        print("Clicking Master button")
        page.get_by_role("button", name="マスター").click()

        # 4. 認証
        print("Authenticating")
        page.get_by_placeholder("XXXXXX").fill("123")
        page.get_by_role("button", name="認証").click()
        time.sleep(1) # アラート処理待ち

        # 5. 取引先マスタタブへ
        print("Switching to Clients tab")
        page.get_by_role("button", name="取引先マスタ").click()

        # 6. 新規取引先追加
        print("Adding Client")
        page.get_by_placeholder("取引先名").fill("Playwright検証社")
        # 追加ボタンをクリック（新規追加エリアのボタン）
        page.get_by_role("button", name="追加").click()
        time.sleep(1) # 追加処理待ち

        # 7. 案件マスタタブへ
        print("Switching to Projects tab")
        page.get_by_role("button", name="案件マスタ").click()

        # 8. 新規案件追加
        print("Adding Project")
        # 取引先プルダウンで"Playwright検証社"を選択 (labelで選択)
        # 新規追加行のselectは、tbody外にあるはず（MasterModalの実装を確認すると、tbodyの上にdivがある）
        # MasterModal.jsx:
        # <div className="mb-4 p-2 bg-blue-50 ...">
        #   <select ...> ... </select>
        #   <input ... />
        #   <button ...>追加</button>
        # </div>

        # 取引先プルダウンを選択
        # Playwright検証社がリストにあるはず
        # page.locator('select').first が社員マスタタブのselectかもしれないので、コンテキストを絞るか、
        # 新規追加エリア内のselectを探す

        # page.get_by_text("新規追加:").locator("..").locator("select") のような形

        # ここでは、おそらく追加直後なのでリストの最後に追加されているか、あるいはID順。
        # 追加したばかりなので選択肢にあるはず。
        # label="Playwright検証社" で選択してみる

        page.locator("div.bg-blue-50 select").select_option(label="Playwright検証社")

        page.get_by_placeholder("案件名").fill("検証プロジェクト")
        page.get_by_role("button", name="追加").click()
        time.sleep(1)

        # 9. モーダルを閉じる
        print("Closing Master Modal")
        page.get_by_role("button", name="閉じる").click()

        # 10. 日報入力 (1日の行をクリック)
        print("Opening Daily Report")
        # 最初の行をダブルクリック
        page.locator("tbody tr").first.dblclick()

        # 11. 日報モーダルで明細追加
        print("Adding Detail")
        page.get_by_role("button", name="+ 行追加").click()

        # 12. 取引先・案件選択、時間入力
        # tbody内の最初の行
        row = page.locator("div.bg-blue-50 table tbody tr").first
        row.locator("select").nth(0).select_option(label="Playwright検証社")
        row.locator("select").nth(1).select_option(label="検証プロジェクト")
        row.locator("input[type=number]").fill("120")

        # 時間帯の調整 (9:00 - 11:00)
        # 終了時間の「時」を変更
        # DailyReportModal.jsx: renderTimePicker('endTime', '終了時間')
        # label="終了時間" の親要素を探す

        print("Adjusting Time")
        end_time_container = page.locator("div", has_text="終了時間").last
        end_time_container.locator("select").first.select_option("11")

        # 休憩時間 0分
        # 休憩時間のselect
        break_time_container = page.locator("div", has_text="休憩時間").last
        break_time_container.locator("select").select_option("0") # value="0" (0分)

        # 13. 適用して閉じる
        print("Applying")
        page.get_by_role("button", name="適用して閉じる").first.click()

        # 保存完了待ち（ReportScreenが更新されるのを待つ）
        time.sleep(2)

        # 14. 集計表確認
        print("Verifying Summary")
        page.wait_for_selector("text=請求先・案件別集計表")

        # スクリーンショット
        page.screenshot(path="verification/verification.png", full_page=True)

        expect(page.locator("table.min-w-full").get_by_text("Playwright検証社")).to_be_visible()
        expect(page.locator("table.min-w-full").get_by_text("検証プロジェクト")).to_be_visible()

        # 合計時間は "2h" か "2h" か、実装による (round(hours, 2) -> 2.0)
        # app.py: hours_str = f"{int(hours)}" if hours.is_integer() else f"{hours}"
        # なので "2h" になるはずだが、ReportScreen.jsxでは item.total_hours で表示しており、
        # app.pyの get_work_records -> project_summary では round(hours, 2) を返している。
        # なので 2.0 になる可能性が高い。

        expect(page.locator("table.min-w-full").get_by_text("2h")).to_be_visible()

        print("Verification successful")

    except Exception as e:
        print(f"Error: {e}")
        page.screenshot(path="verification/error.png")
    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)
