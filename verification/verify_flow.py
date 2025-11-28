from playwright.sync_api import sync_playwright

def verify_approval_flow():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Console logs
        page.on("console", lambda msg: print(f"BROWSER CONSOLE: {msg.text}"))
        page.on("pageerror", lambda exc: print(f"BROWSER ERROR: {exc}"))

        # 1. Login as Employee (ID: 1)
        print("Logging in as Employee...")
        try:
            # Use 127.0.0.1 explicitly
            page.goto("http://127.0.0.1:5173", timeout=60000)
        except Exception as e:
            print(f"Navigation failed: {e}")
            return

        # wait for load event
        page.wait_for_load_state("load")

        # 少し待機
        page.wait_for_timeout(3000)

        # Take a screenshot to see what's happening
        page.screenshot(path="verification/debug_initial_load.png")
        print("Initial load screenshot saved.")

        # ログイン画面が表示されるのを待つ
        try:
            page.wait_for_selector('h2:has-text("勤務表アプリ ログイン")', timeout=10000)
        except:
             print("Login screen selector not found.")
             # Check if we are already logged in?
             if page.is_visible('button:has-text("ログアウト")'):
                 print("Found logout button, logging out...")
                 page.click('button:has-text("ログアウト")')
                 page.wait_for_selector('h2:has-text("勤務表アプリ ログイン")', timeout=5000)
             else:
                 print("Login screen not found and logout button not found.")
                 # Dump content
                 # print(f"Page content: {page.content()}")
                 raise

        # IDとパスワード入力
        page.fill('input[id="employeeId"]', '1')
        page.fill('input[id="password"]', '123')
        page.click('button:has-text("ログイン")')

        # 作業報告書画面が表示されるのを待つ
        page.wait_for_selector('h1:has-text("作業報告書")')
        print("Logged in as Employee.")

        page.wait_for_timeout(2000)

        # スクリーンショット: 社員画面（下書き状態）
        page.screenshot(path="verification/1_employee_draft.png")
        print("Screenshot saved: verification/1_employee_draft.png")

        # 2. 提出 (Submit)
        submit_button = page.locator('button:has-text("提出する")')
        if submit_button.is_visible():
            submit_button.click()
            # 確認ダイアログが出るのでOKする
            page.on("dialog", lambda dialog: dialog.accept())

            # ステータスが「提出済」になるのを待つ
            page.wait_for_selector('span:has-text("提出済")')
            print("Report submitted.")

            # スクリーンショット: 提出後
            page.screenshot(path="verification/2_employee_submitted.png")
            print("Screenshot saved: verification/2_employee_submitted.png")
        else:
            print("Submit button not found. Assuming already submitted or incorrect state.")

        # 3. Logout
        page.click('button:has-text("ログアウト")')
        page.wait_for_selector('h2:has-text("勤務表アプリ ログイン")')

        # 4. Login as Manager (ID: 2)
        print("Logging in as Manager...")
        page.fill('input[id="employeeId"]', '2')
        page.fill('input[id="password"]', '123')
        page.click('button:has-text("ログイン")')

        page.wait_for_selector('h1:has-text("作業報告書")')
        print("Logged in as Manager.")

        page.wait_for_timeout(1000)

        # 社員（ID: 1）を選択して表示
        # 3番目のselectが社員選択 (年, 月, 社員)
        # ID: 1 のoptionを選択
        page.select_option('select >> nth=2', '1')

        # データのロード待ち
        page.wait_for_timeout(2000)

        # スクリーンショット: 部長画面（承認待ち）
        page.screenshot(path="verification/3_manager_approval_wait.png")
        print("Screenshot saved: verification/3_manager_approval_wait.png")

        # 5. Approve
        approve_button = page.locator('button:has-text("承認")')
        if approve_button.is_visible():
            approve_button.click()
            page.on("dialog", lambda dialog: dialog.accept())

            # ステータスが「部長承認済」になるのを待つ
            page.wait_for_selector('span:has-text("部長承認済")')
            print("Report approved by Manager.")

            # スクリーンショット: 部長承認後
            page.screenshot(path="verification/4_manager_approved.png")
            print("Screenshot saved: verification/4_manager_approved.png")
        else:
            print("Approve button not found.")

        # 6. Logout
        page.click('button:has-text("ログアウト")')

        # 7. Login as Accounting (ID: 4)
        print("Logging in as Accounting...")
        page.fill('input[id="employeeId"]', '4')
        page.fill('input[id="password"]', '123')
        page.click('button:has-text("ログイン")')

        page.wait_for_selector('h1:has-text("作業報告書")')
        print("Logged in as Accounting.")

        page.wait_for_timeout(1000)

        # 社員（ID: 1）を選択
        page.select_option('select >> nth=2', '1')
        page.wait_for_timeout(2000)

        # スクリーンショット: 経理画面（最終承認待ち）
        page.screenshot(path="verification/5_accounting_wait.png")
        print("Screenshot saved: verification/5_accounting_wait.png")

        # 8. Finalize
        finalize_button = page.locator('button:has-text("完了 (最終承認)")')
        if finalize_button.is_visible():
            finalize_button.click()
            page.on("dialog", lambda dialog: dialog.accept())

            # ステータスが「完了」になるのを待つ
            page.wait_for_selector('span:has-text("完了")')
            print("Report finalized by Accounting.")

            # スクリーンショット: 完了後
            page.screenshot(path="verification/6_accounting_finalized.png")
            print("Screenshot saved: verification/6_accounting_finalized.png")
        else:
             print("Finalize button not found.")

        browser.close()

if __name__ == "__main__":
    verify_approval_flow()
