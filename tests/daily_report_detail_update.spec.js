const { test, expect } = require('@playwright/test');

test('reproduce bug: updating detail triggers nothing changed', async ({ page }) => {
  // Login
  await page.goto('http://localhost:5173/');
  await page.fill('#employeeId', '2');
  await page.fill('#password', '123');
  await page.click('button:has-text("ログイン")');

  // Wait for report table to load.
  await page.waitForSelector('table');

  // Open daily report for day 1 (double click)
  // Use the first table (ReportTable)
  const reportTable = page.locator('table').first();
  const row = reportTable.locator('tbody tr').filter({ has: page.locator('td').first().filter({ hasText: /^1$/ }) });

  // Ensure we have exactly one row
  await expect(row).toHaveCount(1);
  await row.dblclick();

  // Wait for modal
  const modalHeader = page.locator('h2').filter({ hasText: '日報入力' });
  await expect(modalHeader).toBeVisible();

  // Add a detail row
  await page.click('button:has-text("+ 行追加")');

  // Locate the first detail row in the modal
  // Find the container div that has the '作業内訳' header AND a table.
  const detailsSection = page.locator('div').filter({ has: page.locator('h3', { hasText: '作業内訳' }) })
                                            .filter({ has: page.locator('table') });
  const detailsTable = detailsSection.locator('table');

  // Wait for the row with select to appear (replacing "No details" row)
  await expect(detailsTable.locator('select').first()).toBeVisible();

  const detailRow = detailsTable.locator('tbody tr').first();

  // Select Client (index 1)
  await detailRow.locator('select').first().selectOption({ index: 1 });

  // Select Project (index 1)
  await detailRow.locator('select').nth(1).selectOption({ index: 1 });

  // Set time to 60
  await detailRow.locator('input[type="number"]').fill('60');

  // Handle dialogs (alerts)
  page.on('dialog', async dialog => {
    // console.log(`Dialog message: ${dialog.message()}`);
    await dialog.accept();
  });

  // Save (click the button inside the modal)
  const modalSaveButton = page.locator('.ReactModal__Content button:has-text("保存")').first();
  await modalSaveButton.click();

  // Expect modal to close
  await expect(modalHeader).toBeHidden();

  // Re-open the same report
  await row.dblclick();
  await expect(modalHeader).toBeVisible();

  // Verify detail is loaded (time 60)
  const detailRow2 = detailsTable.locator('tbody tr').first();
  await expect(detailRow2.locator('input[type="number"]')).toHaveValue('60');

  // Change time to 90
  await detailRow2.locator('input[type="number"]').fill('90');

  // Capture alert specifically for the bug check
  let bugDetected = false;

  page.removeAllListeners('dialog');
  page.on('dialog', async dialog => {
      console.log(`Dialog message during update: ${dialog.message()}`);
      if (dialog.message() === '何も変わってはいません') {
          bugDetected = true;
      }
      await dialog.accept();
  });

  // Attempt to Save
  await modalSaveButton.click();

  // Wait a bit to ensure dialog has chance to appear
  await page.waitForTimeout(1000);

  // Assert that bug was detected (expecting fail for reproduction)
  if (!bugDetected) {
      // If no bug detected, check if modal closed (meaning save success)
      const modalVisible = await page.locator('h2').filter({ hasText: '日報入力' }).isVisible();
      if (!modalVisible) {
           // Passed (Fixed)
           // For reproduction step, we might want to assert failure?
           // The instructions say "Reproduce Issue -> Run test (expect fail)".
           // If it passes, then I failed to reproduce it.
           console.log("Save successful (Bug NOT reproduced)");
      } else {
           console.log("Modal still open, save failed silently?");
      }
  } else {
      console.log("Bug reproduced: '何も変わってはいません' alert shown.");
  }

  // Final assertion: bugDetected should be false (because this is the desired behavior)
  // But for the reproduction step, I expect this assertion to FAIL.
  expect(bugDetected, 'Update should be accepted, but "Nothing has changed" alert was shown').toBe(false);
});
