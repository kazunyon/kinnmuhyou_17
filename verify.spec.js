const { test, expect } = require('@playwright/test');

test('verify changes', async ({ page }) => {
  await page.goto('http://localhost:5173/');

  // テーブルが表示されるのを待ちます
  await page.waitForSelector('table');

  // 「代休」リンクが存在し、正しいhref属性を持っていることを確認します
  const daikyuLink = page.locator('a:has-text("代休")');
  await expect(daikyuLink).toBeVisible();
  await expect(daikyuLink).toHaveAttribute('href', '/holiday_difference.docx');
  await expect(daikyuLink).toHaveAttribute('target', '_blank');

  // 「振休」リンクが存在し、正しいhref属性を持っていることを確認します
  const furikyuLink = page.locator('a:has-text("振休")');
  await expect(furikyuLink).toBeVisible();
  await expect(furikyuLink).toHaveAttribute('href', '/holiday_difference.docx');
  await expect(furikyuLink).toHaveAttribute('target', '_blank');

  // 「休日出勤」というテキストが存在しないことを確認します
  await expect(page.locator('text=休日出勤')).not.toBeVisible();

  // ページのスクリーンショットを撮ります
  await page.screenshot({ path: 'verification.png' });
});
