const { test, expect } = require('@playwright/test');

test('verify work detail and aggregation features', async ({ page }) => {
  // 1. アプリケーションのメインページにアクセス
  await page.goto('http://localhost:5175/');

  // 2. メインの勤務表テーブルが表示されるまで待機
  // 画面の主要な要素が読み込まれるのを保証する
  await page.waitForSelector('h1:has-text("作業報告書")');
  await page.waitForSelector('table');

  // 3. 作業明細を追加するためのUI要素が存在するか確認
  // 各行に "+" ボタンが存在すると仮定する。
  const addDetailButton = page.locator('table tbody tr:first-child button:has-text("+")').first();
  await expect(addDetailButton).toBeVisible();

  // 4. 画面下部に「請求先・案件別 集計表」という見出しが表示されているか確認
  const summaryHeader = page.locator('h2:has-text("請求先・案件別 集計表")');
  await expect(summaryHeader).toBeVisible();

  // 5. 集計表のテーブル自体が存在することを確認
  // 見出しの直後にあるテーブルを想定
  const summaryTable = summaryHeader.locator('+ table');
  await expect(summaryTable).toBeVisible();

  // 6. 集計表に期待されるヘッダーが存在することを確認
  await expect(summaryTable.locator('th:has-text("請求先")')).toBeVisible();
  await expect(summaryTable.locator('th:has-text("案件")')).toBeVisible();
  await expect(summaryTable.locator('th:has-text("合計時間")')).toBeVisible();

  // 7. 重複していた作業時間列が削除されていることを確認
  const deletedColumnHeader = page.locator('th:has-text("⑤作業時間")');
  await expect(deletedColumnHeader).not.toBeVisible();

  // 8. 変更点のスクリーンショットを撮影
  await page.screenshot({ path: 'verification.png' });
});
