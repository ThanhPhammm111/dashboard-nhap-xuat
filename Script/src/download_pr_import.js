const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

(async () => {
  console.log('=== STARTING AUTOMATED IMPORT FILE (PR) DOWNLOAD ===');
  const chromePath = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
  const downloadDir = 'G:\\Drive của tôi\\Report\\Đối chiếu xuất hàng\\Data\\Nhập';
  
  // Date Logic: D-1, or D-2 if today is Monday (Day 1)
  const today = new Date();
  let target = new Date();
  if (today.getDay() === 1) { // Monday is 1
    target.setDate(today.getDate() - 2); // Saturday (D-2)
    console.log('Today is Monday. Target date is Saturday (D-2).');
  } else {
    target.setDate(today.getDate() - 1); // Yesterday (D-1)
    console.log('Target date is yesterday (D-1).');
  }
  
  const dd = String(target.getDate()).padStart(2, '0');
  const mm = String(target.getMonth() + 1).padStart(2, '0');
  const yyyy = target.getFullYear();
  const dateStr = `${dd}${mm}${yyyy}`;
  const targetDateStr = `${dd}/${mm}/${yyyy}`;
  
  console.log(`Target date string: ${targetDateStr}`);
  const targetFileName = `PR_${dateStr}.xlsx`;
  const targetFilePath = path.join(downloadDir, targetFileName);
  const statePath = path.join(__dirname, 'state.json');

  // Create folder if not exists, and clear old xlsx files
  if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir, { recursive: true });
  } else {
    const files = fs.readdirSync(downloadDir);
    for (const file of files) {
      if (file.toLowerCase().endsWith('.xlsx')) {
        try {
          fs.unlinkSync(path.join(downloadDir, file));
        } catch (e) {
          console.log(`Could not delete old file ${file}:`, e.message);
        }
      }
    }
  }

  let browser;
  let context;
  let page;
  let isLoggedIn = false;

  async function startBrowser(headless) {
    console.log(`Launching Chrome (headless: ${headless}) at:`, chromePath);
    browser = await chromium.launch({
      executablePath: chromePath,
      headless: headless
    });

    const contextOptions = {
      acceptDownloads: true,
      viewport: { width: 1440, height: 900 }
    };

    if (fs.existsSync(statePath)) {
      console.log('Loading saved session state from state.json...');
      contextOptions.storageState = statePath;
    }

    context = await browser.newContext(contextOptions);
    page = await context.newPage();

    console.log('Navigating to Purchase PR page...');
    await page.goto('https://next.kingfood.co/purchase/pr?page_size=500&page=1', {
      waitUntil: 'load',
      timeout: 60000
    });

    await page.waitForTimeout(5000);

    const currentUrl = page.url();
    console.log('Current URL after load:', currentUrl);

    if (currentUrl.includes('/login') || currentUrl.includes('accounts.haravan.com')) {
      console.log('Not logged in.');
      return false;
    } else {
      console.log('Successfully logged in.');
      return true;
    }
  }

  try {
    // 1. Try launching headlessly
    isLoggedIn = await startBrowser(true);

    // 2. If not logged in, launch headfully for manual login
    if (!isLoggedIn) {
      if (browser) await browser.close();
      
      console.log('\n=============================================================');
      console.log('YÊU CẦU ĐĂNG NHẬP: Trình duyệt Chrome đang được mở.');
      console.log('Vui lòng thực hiện đăng nhập trên cửa sổ Chrome vừa hiện ra.');
      console.log('Script sẽ tự động tiếp tục sau khi đăng nhập thành công.');
      console.log('=============================================================\n');

      isLoggedIn = await startBrowser(false);

      if (!isLoggedIn) {
        console.log('Đang chờ bạn hoàn thành đăng nhập (tối đa 3 phút)...');
        try {
          await page.waitForURL(url => url.pathname.includes('/purchase/pr'), { timeout: 180000 });
          console.log('Đăng nhập thành công!');
          await page.context().storageState({ path: statePath });
          console.log('Đã lưu phiên làm việc mới vào state.json');
        } catch (e) {
          console.error('Lỗi: Đăng nhập quá thời gian (3 phút) hoặc thất bại.');
          if (browser) await browser.close();
          process.exit(1);
        }
      }
    }

    // 3. Open filter panel
    console.log('Opening filter panel...');
    const funnelButton = page.locator('button.kf-btn').first();
    await funnelButton.click();
    await page.waitForTimeout(2000);

    // 4. Select Branch (LHABA, QCABA)
    console.log('Selecting Branches (LHABA, QCABA)...');
    const branchContainer = page.locator('.ant-form-item', { hasText: 'Chi nhánh' });
    await branchContainer.locator('.ant-select-selector').click();
    await page.waitForTimeout(1000);
    const branchSearchInput = branchContainer.locator('input.ant-select-selection-search-input');

    // Select LHABA
    await branchSearchInput.fill('LHABA');
    await page.waitForTimeout(1500);
    await page.locator('.ant-select-item-option-content', { hasText: 'LHABA - KHO ABA LƯU HÀNG' }).first().click();
    await page.waitForTimeout(500);

    // Select QCABA
    await branchSearchInput.fill('QCABA');
    await page.waitForTimeout(1500);
    await page.locator('.ant-select-item-option-content', { hasText: 'QCABA - KHO ABA QUÁ CẢNH' }).first().click();
    await page.waitForTimeout(500);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // 5. Select Status (Đã nhận hàng, Released)
    console.log('Selecting Statuses (Đã nhận hàng, Released)...');
    const statusContainer = page.locator('.ant-form-item', { hasText: 'Trạng thái' });
    await statusContainer.locator('.ant-select-selector').click();
    await page.waitForTimeout(1000);
    const statusSearchInput = statusContainer.locator('input.ant-select-selection-search-input');

    // Select Đã nhận hàng
    await statusSearchInput.fill('Đã nhận hàng');
    await page.waitForTimeout(1500);
    await page.locator('.ant-select-item-option-content', { hasText: 'Đã nhận hàng' }).first().click();
    await page.waitForTimeout(500);

    // Select Released
    await statusSearchInput.fill('Released');
    await page.waitForTimeout(1500);
    await page.locator('.ant-select-item-option-content', { hasText: 'Released' }).first().click();
    await page.waitForTimeout(500);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // 6. Select "Ngày giao hàng NCC xác nhận" to targetDateStr
    console.log(`Setting Ngày giao hàng NCC xác nhận: ${targetDateStr}`);
    const dateContainer = page.locator('.ant-form-item', { hasText: 'Ngày giao hàng NCC xác nhận' });
    const fromInput = dateContainer.locator('input[placeholder="Từ ngày"]');
    const toInput = dateContainer.locator('input[placeholder="Đến ngày"]');

    await fromInput.click();
    await fromInput.fill('');
    await fromInput.type(targetDateStr);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    await toInput.click();
    await toInput.fill('');
    await toInput.type(targetDateStr);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    // 7. Click Áp dụng
    console.log('Clicking Áp dụng...');
    await page.locator('button', { hasText: 'Áp dụng' }).click();
    await page.waitForTimeout(10000); // Wait 10s for table to reload

    // 8. Close the filter panel to remove the drawer mask
    console.log('Closing Filter Drawer/Mask...');
    try {
      const closeBtn = page.locator('header:has-text("Bộ lọc") button, button:has-text("x"), .ant-drawer-close').first();
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
      } else {
        await page.keyboard.press('Escape');
      }
    } catch (e) {
      await page.keyboard.press('Escape');
    }
    await page.waitForTimeout(3000);

    // 9. Click "Xuất file" using bulletproof loop
    console.log('Opening "Xuất file" dropdown...');
    const exportBtn = page.locator('button', { hasText: 'Xuất file' }).first();
    const detailOption = page.locator('.ant-dropdown-menu-item, li[role="menuitem"]', { hasText: 'Xuất file chi tiết' }).first();
    
    let isOpen = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      console.log(`Clicking Export button (attempt ${attempt})...`);
      await exportBtn.click();
      await page.waitForTimeout(2000);
      
      const isVisible = await detailOption.isVisible();
      if (isVisible) {
        console.log('Option "Xuất file chi tiết" is now visible!');
        isOpen = true;
        break;
      }
    }

    if (!isOpen) {
      console.log('Dropdown option not visible, trying span click...');
      await page.locator('span:has-text("Xuất file")').first().click();
      await page.waitForTimeout(2000);
    }

    console.log('Clicking "Xuất file chi tiết" option...');
    await detailOption.click();

    // 10. Wait for confirmation modal and click Confirm to start download
    console.log('Waiting for confirmation modal...');
    const confirmBtn = page.locator('.ant-modal-content button, button:has-text("Xác nhận")').filter({ hasText: 'Xác nhận' }).first();
    await confirmBtn.waitFor({ state: 'visible', timeout: 15000 });

    console.log('Clicking "Xác nhận" to confirm download...');
    const [ download ] = await Promise.all([
      page.waitForEvent('download', { timeout: 180000 }),
      confirmBtn.click()
    ]);

    console.log('Downloading file...');
    await download.saveAs(targetFilePath);
    console.log('SUCCESS: Download completed!');
    console.log('Saved to:', targetFilePath);

  } catch (e) {
    console.error('ERROR during automated download:', e.message);
    if (browser) await browser.close();
    process.exit(1);
  }

  if (browser) await browser.close();
  console.log('=== DOWNLOAD COMPLETED SUCCESSFULLY ===');
})();
