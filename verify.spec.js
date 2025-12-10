const { test, expect } = require('@playwright/test');

test('verify deleted_flag update', async ({ page }) => {
  await page.goto('http://localhost:5173/');

  // デバッグ用に初期表示のスクリーンショットを撮影
  await page.screenshot({ path: 'verification/debug_initial_page.png' });

  // ログイン処理
  await page.fill('#employeeId', '2');
  await page.fill('#password', '123');
  await page.click('button:has-text("ログイン")');

  // ログイン後の画面ロードを待機 (マスターボタンが表示されるまで)
  await page.waitForSelector('button:has-text("マスター")', { timeout: 10000 });

  // マスターメンテナンスボタンをクリック
  await page.click('button:has-text("マスター")');

  // 案件マスタタブをクリック
  await page.click('button:has-text("案件マスタ")');

  // 最初のtd要素（ID列）が正確に"2"である行を特定する
  const projectRow = page.locator('tr').filter({
    has: page.locator('td').nth(0).filter({ hasText: /^2$/ })
  });

  // その行に含まれる2番目のselect要素（削除フラグ）の値を変更する
  await projectRow.locator('select').nth(1).selectOption('1');

  // 更新ボタンをクリック
  await projectRow.locator('button:has-text("更新")').click();

  // アラートが表示されたらOKをクリックするよう設定
  page.on('dialog', dialog => dialog.accept());

  // 一度モーダルを閉じる
  await page.click('button:has-text("閉じる")');

  // --- 検証フェーズ ---
  // 再度マスターメンテナンスを開く
  await page.click('button:has-text("マスター")');
  await page.click('button:has-text("案件マスタ")');

  // ID 2の案件の行を再度特定
  const updatedProjectRow = page.locator('tr').filter({
    has: page.locator('td').nth(0).filter({ hasText: /^2$/ })
  });

  // 削除フラグが「あり」("1")になっていることを確認
  const selectValue = await updatedProjectRow.locator('select').nth(1).inputValue();
  expect(selectValue).toBe('1');

  await page.screenshot({ path: 'verification/verification.png' });
});
