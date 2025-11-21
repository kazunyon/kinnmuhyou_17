
from playwright.sync_api import sync_playwright, expect

def verify_daily_report_modal():
    with sync_playwright() as p:
        # headless=True で実行
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # バックエンドがビルド済みフロントエンドを配信しているので 5000 番ポートにアクセス
        try:
            page.goto("http://localhost:5000")
        except Exception as e:
            print(f"Failed to connect to app: {e}")
            browser.close()
            return

        # ページがロードされるのを待つ
        page.wait_for_timeout(3000)

        try:
             # テーブルの最初のデータ行（tbodyの最初のtr）の特定セルをクリック
             # ReportTable.jsxの実装では <tr ... onDoubleClick={() => onRowClick(record)}> となっている
             # onRowClickはダブルクリックで発火するようだ

             # まずテーブルが表示されているか確認
             page.wait_for_selector("table", timeout=5000)

             # tbody内の最初の行をダブルクリック
             page.locator("table tbody tr").first.dblclick()

             # モーダルが表示されるのを待つ
             page.wait_for_selector(".ReactModal__Content", timeout=5000)

             # スクリーンショット保存 (モーダルが開いた状態)
             page.screenshot(path="verification/frontend_modal.png")
             print("Screenshot saved to verification/frontend_modal.png")

             # "作業内容" のラベルを確認
             # 変更前: "作業内容 (明細から自動生成されますが、手動編集も可能です)"
             # 変更後: "作業内容"

             # "作業内容" というテキストを含むラベルを探す
             label = page.locator("label", has_text="作業内容")

             # 完全一致または部分一致で検証
             # innerTextを取得して検証するのが確実
             label_text = label.inner_text()
             print(f"Label text found: '{label_text}'")

             if "作業内容 (明細から自動生成されますが、手動編集も可能です)" not in label_text and "作業内容" in label_text:
                 print("SUCCESS: Label text is correct.")
             else:
                 print("FAILURE: Label text is incorrect.")

        except Exception as e:
            print(f"Error during interaction: {e}")
            page.screenshot(path="verification/error.png")

        browser.close()

if __name__ == "__main__":
    verify_daily_report_modal()
