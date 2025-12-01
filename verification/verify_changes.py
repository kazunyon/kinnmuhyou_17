from playwright.sync_api import sync_playwright, expect
import time
import re

def verify_changes():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1920, 'height': 1080})
        page = context.new_page()

        try:
            # 1. アプリケーションにアクセス
            page.goto("http://localhost:5173")

            # ログイン (ID: 1, PW: 123)
            # placeholderがないので、IDやlabelで要素を特定する
            page.fill('input#employeeId', '1')
            page.fill('input#password', '123')
            page.click('button:has-text("ログイン")')

            # ログイン完了を待つ (作業報告書画面が表示されるはず)
            page.wait_for_selector('h1:has-text("作業報告書")', timeout=10000)

            # ---------------------------------------------------------
            # 検証項目2: 「欠勤」のスタイル確認
            # ---------------------------------------------------------
            # 任意の日付のテキストエリアに「欠勤」と入力してスタイルを確認
            # 最初の行（1日）のテキストエリアを取得
            first_row_textarea = page.locator('table tbody tr').first.locator('textarea')
            first_row_textarea.fill('欠勤')
            # フォーカスを外してReactの状態更新をトリガー
            page.click('body')

            # 少し待つ
            time.sleep(1)

            # クラスに bg-black が含まれているか確認
            # 注: Tailwindのクラスが適用されているか
            expect(first_row_textarea).to_have_class(re.compile(r'bg-black'))
            expect(first_row_textarea).to_have_class(re.compile(r'text-white'))

            print("Verified: '欠勤' background is black.")

            # ---------------------------------------------------------
            # 検証項目1: 日報入力モーダルでの休憩時間初期値
            # ---------------------------------------------------------
            # 2日目の行をダブルクリックしてモーダルを開く (まだ未入力と仮定)
            second_row = page.locator('table tbody tr').nth(1)
            second_row.dblclick()

            # モーダルが開くのを待つ
            page.wait_for_selector('h2:has-text("日報入力")', timeout=5000)

            # 休憩時間のselect要素の値を確認
            # 「休憩時間」のラベルの隣にあるselectを取得する必要がある
            # DailyReportModal.jsxの実装を見ると、休憩時間は "01:00" のような形式ではなく、分単位のselectになっている
            # <select ... value={60}> ... </select> のようになっているはず

            # DOM構造:
            # <div className="flex items-center space-x-2 ml-8">
            #   <span>休憩時間</span>
            #   <select ...>

            break_time_select = page.locator('div:has-text("休憩時間") >> select').last

            # 60分 (value="60") が選択されているか確認
            expect(break_time_select).to_have_value("60")

            print("Verified: Initial break time is 60 minutes.")

            # スクリーンショット撮影
            page.screenshot(path="verification/verification_result.png")

        except Exception as e:
            print(f"Verification failed: {e}")
            page.screenshot(path="verification/verification_failed.png")
            raise e
        finally:
            browser.close()

if __name__ == "__main__":
    verify_changes()
