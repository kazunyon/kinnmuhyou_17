from playwright.sync_api import sync_playwright, expect
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # 画面サイズを大きめに設定
        context = browser.new_context(viewport={'width': 1280, 'height': 800})
        page = context.new_page()

        # 1. アプリケーションにアクセス
        page.goto("http://localhost:5173/")
        time.sleep(3) # 初期ロード待機

        # 2. ログイン
        login_btn = page.get_by_role("button", name="ログイン")
        if login_btn.is_visible():
             login_btn.click()
             time.sleep(3) # ログイン処理待機

        # 3. 承認状況表モーダルを開く
        try:
            # ログイン後、承認状況表ボタンが出るまで待つ
            # タイムアウトを長めに設定
            approval_btn = page.get_by_role("button", name="承認状況表")
            if approval_btn.count() > 0:
                 approval_btn.click()
            else:
                print("承認状況表ボタンが見つかりません。")
                page.screenshot(path="verification/button_missing_retry.png")
                return
        except Exception as e:
            print(f"ボタンクリックエラー: {e}")
            page.screenshot(path="verification/error_retry.png")
            return

        time.sleep(2) # モーダル表示待機

        # 4. 変更箇所の検証
        # "部名検索:" ラベルが存在するか
        label = page.locator("text=部名検索:")
        if label.is_visible():
            print("ラベル変更確認OK")
        else:
            print("ラベル変更確認NG")

        # プレースホルダーが "部署名を入力..." になっているか
        input_field = page.get_by_placeholder("部署名を入力...")
        if input_field.is_visible():
            print("プレースホルダー変更確認OK")
        else:
            print("プレースホルダー変更確認NG")

        # スクリーンショット撮影
        page.screenshot(path="verification/verify_approval_final.png")
        print("検証完了: verification/verify_approval_final.png")

        browser.close()

if __name__ == "__main__":
    run()
