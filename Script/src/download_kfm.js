const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

(async () => {
  console.log('=== STARTING AUTOMATED EXPORT ===');
  const chromePath = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
  const downloadDir = 'G:\\Drive của tôi\\Report\\Đối chiếu xuất hàng\\Data\\KFM';
  let dd, mm, yyyy, dateStr;
  let isCustomDate = false;
  if (process.argv[2]) {
    const arg = process.argv[2].trim();
    if (arg.length === 8) {
      dd = arg.substring(0, 2);
      mm = arg.substring(2, 4);
      yyyy = arg.substring(4, 8);
      dateStr = arg;
      isCustomDate = true;
      console.log(`Using custom target date: ${dd}/${mm}/${yyyy}`);
    } else {
      console.error('Invalid date format. Expected DDMMYYYY (e.g., 19072026)');
      process.exit(1);
    }
  } else {
    const today = new Date();
    dd = String(today.getDate()).padStart(2, '0');
    mm = String(today.getMonth() + 1).padStart(2, '0');
    yyyy = today.getFullYear();
    dateStr = `${dd}${mm}${yyyy}`;
  }
  const targetFileName = `KFM_${dateStr}.xlsx`;
  const targetFilePath = path.join(downloadDir, targetFileName);
  const statePath = path.join(__dirname, 'state.json');

  if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir, { recursive: true });
  } else {
    // Clean up old xlsx files in the folder to prevent stale data resolution
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

  // Helper function to launch browser and check login status
  async function startBrowser(headless) {
    console.log(`Launching Chrome (headless: ${headless}) at:`, chromePath);
    browser = await chromium.launch({
      executablePath: chromePath,
      headless: headless
    });

    const contextOptions = {
      acceptDownloads: true,
      viewport: { width: 1280, height: 800 }
    };

    if (fs.existsSync(statePath)) {
      console.log('Loading saved session state from state.json...');
      contextOptions.storageState = statePath;
    }

    context = await browser.newContext(contextOptions);
    page = await context.newPage();

    console.log('Navigating to Kingfood Portal...');
    await page.goto('https://next.kingfood.co/operation/transfer-item/transfer-item-list?page=1&page_size=500', {
      waitUntil: 'networkidle',
      timeout: 60000
    });

    // Wait for client-side redirection to settle
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
    // 1. Try launching headlessly with saved state
    isLoggedIn = await startBrowser(true);

    // 2. If not logged in, close headless and launch headfully for manual login
    if (!isLoggedIn) {
      if (browser) await browser.close();
      
      console.log('\n=============================================================');
      console.log('YÊU CẦU ĐĂNG NHẬP: Trình duyệt Chrome đang được mở.');
      console.log('Vui lòng thực hiện đăng nhập trên cửa sổ Chrome vừa hiện ra.');
      console.log('Script sẽ tự động tiếp tục và lưu phiên làm việc sau khi đăng nhập thành công.');
      console.log('=============================================================\n');

      isLoggedIn = await startBrowser(false);

      if (!isLoggedIn) {
        console.log('Đang chờ bạn hoàn thành đăng nhập (tối đa 3 phút)...');
        try {
          // Wait for redirect back to dashboard or list page
          await page.waitForURL(url => url.pathname.includes('/dashboard') || url.pathname.includes('/transfer-item-list'), { timeout: 180000 });
          console.log('Đăng nhập thành công!');
          // Save session state
          await context.storageState({ path: statePath });
          console.log('Đã lưu phiên đăng nhập vào file state.json.');
          
          if (page.url().includes('/dashboard')) {
            console.log('Redirecting to Transfer Item List...');
            await page.goto('https://next.kingfood.co/operation/transfer-item/transfer-item-list?page=1&page_size=500', {
              waitUntil: 'networkidle',
              timeout: 60000
            });
          }
          await page.waitForTimeout(3000);
        } catch (err) {
          console.error('Quá thời gian chờ đăng nhập (3 phút). Dừng tiến trình.');
          process.exit(1);
        }
      }
    }

    // 3. Apply Filters
    console.log('Opening Filter Drawer...');
    const filterBtn = page.locator('button:has(svg path[d*="M18,28H14"]), button:has-text("Bộ lọc")').first();
    await filterBtn.click();
    await page.waitForTimeout(2000);

    // Filter "Nơi chuyển" -> "ABA Quá"
    console.log('Filtering "Nơi chuyển" to "ABA Quá"...');
    const noiChuyenContainer = page.locator('.ant-form-item').filter({ hasText: 'Nơi chuyển' }).first();
    const noiChuyenInput = noiChuyenContainer.locator('input, [role="combobox"]').first();
    await noiChuyenInput.click();
    await page.waitForTimeout(1000);
    await page.keyboard.insertText('ABA');
    await page.waitForTimeout(1500);
    const abaOption = page.locator('.ant-select-item-option, .ant-select-item, [role="option"]').filter({ hasText: 'ABA QUÁ CẢNH' }).first();
    await abaOption.click();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // Filter "Nơi nhận" -> "Tất cả siêu thị"
    console.log('Filtering "Nơi nhận" to "Tất cả siêu thị"...');
    const noiNhanContainer = page.locator('.ant-form-item').filter({ hasText: 'Nơi nhận' }).first();
    const noiNhanInput = noiNhanContainer.locator('input, [role="combobox"]').first();
    await noiNhanInput.click();
    await page.waitForTimeout(1500);
    const sieuThiOption = page.locator('.ant-select-item-option, .ant-select-item, [role="option"]').filter({ hasText: 'Tất cả siêu thị' }).first();
    await sieuThiOption.click();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // Scroll the drawer down to make sure Ngày tạo is visible
    console.log('Scrolling drawer to show "Ngày tạo"...');
    const drawerBody = page.locator('.ant-drawer-body').first();
    if (await drawerBody.isVisible()) {
      await drawerBody.evaluate(el => el.scrollTop = 800);
    }
    await page.waitForTimeout(1000);

    // Filter "Ngày tạo" -> Today or Custom Date
    const targetDateFormatted = `${dd}/${mm}/${yyyy}`; // dd/mm/yyyy
    console.log(`Filtering "Ngày tạo" to ${targetDateFormatted}...`);
    const ngayTaoContainer = page.locator('.ant-form-item').filter({ hasText: 'Ngày tạo' }).first();
    const ngayTaoInput = ngayTaoContainer.locator('input').first();
    await ngayTaoInput.click();
    await page.waitForTimeout(1000);
    
    if (isCustomDate) {
      console.log(`Typing custom date: ${targetDateFormatted}`);
      await ngayTaoInput.fill(targetDateFormatted);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
      
      const ngayTaoInputEnd = ngayTaoContainer.locator('input').last();
      await ngayTaoInputEnd.fill(targetDateFormatted);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
    } else {
      // Scope the "Hôm nay" button to the picker dropdown to avoid clicking main page elements
      const homNayBtn = page.locator('.ant-picker-dropdown button:has-text("Hôm nay"), .ant-picker-dropdown a:has-text("Hôm nay"), .ant-picker-dropdown span:has-text("Hôm nay"), .ant-picker-dropdown [class*="preset"]:has-text("Hôm nay"), .ant-picker-dropdown .ant-picker-preset button').first();
      await homNayBtn.click();
      await page.waitForTimeout(1000);

      // Verify filter value and apply typing fallback if empty
      const dateVal = await ngayTaoInput.inputValue();
      console.log('Date filter value after selection:', dateVal);

      if (!dateVal) {
        console.log('Warning: Date filter is empty. Attempting fallback by typing date...');
        await ngayTaoInput.fill(targetDateFormatted);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(500);
        
        const ngayTaoInputEnd = ngayTaoContainer.locator('input').last();
        await ngayTaoInputEnd.fill(targetDateFormatted);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(1000);
        
        const dateValVerify = await ngayTaoInput.inputValue();
        console.log('Date filter value after fallback typing:', dateValVerify);
      }
    }

    // Apply Filter
    console.log('Applying filters...');
    const applyBtn = page.locator('button:has-text("Áp dụng"), button[type="submit"]').first();
    await applyBtn.click();
    await page.waitForTimeout(3000);

    // Close the drawer if still open (mask intercepts pointer events otherwise)
    console.log('Closing Filter Drawer...');
    try {
      const closeBtn = page.locator('.ant-drawer-close, button[aria-label="Close"]').first();
      if (await closeBtn.isVisible()) {
        await closeBtn.click({ force: true });
      } else {
        await page.keyboard.press('Escape');
      }
    } catch (e) {
      console.log('Could not click close button, trying Escape...');
      await page.keyboard.press('Escape');
    }
    
    // Explicitly wait for the drawer mask to disappear completely
    console.log('Waiting for drawer mask to be hidden...');
    try {
      await page.locator('.ant-drawer-mask').first().waitFor({ state: 'hidden', timeout: 8000 });
      console.log('Drawer mask is successfully hidden.');
    } catch (e) {
      console.log('Warning: Drawer mask did not hide in time, attempting to force hide via JS...');
      await page.evaluate(() => {
        const mask = document.querySelector('.ant-drawer-mask');
        if (mask) mask.style.display = 'none';
        const content = document.querySelector('.ant-drawer-content-wrapper');
        if (content) content.style.display = 'none';
      });
    }
    await page.waitForTimeout(1000);

    // Export File
    console.log('Exporting data...');
    const exportBtn = page.locator('button:has-text("Xuất file"), button:has-text("Export"), button:has-text("Xuất Excel")').first();
    await exportBtn.click();
    await page.waitForTimeout(1000);

    const optionDetail = page.locator('li:has-text("Chi tiết phiếu chuyển"), span:has-text("Chi tiết phiếu chuyển"), li:has-text("Chi tiết"), span:has-text("Chi tiết")').first();
    if (await optionDetail.isVisible()) {
      console.log('Selecting "Chi tiết phiếu chuyển theo filter" option...');
      const downloadPromise = page.waitForEvent('download', { timeout: 120000 });
      await optionDetail.click();
      const download = await downloadPromise;

      console.log('Downloading file...');
      await download.saveAs(targetFilePath);
      console.log('Download completed. File saved to:', targetFilePath);
    } else {
      console.log('Export button clicked, waiting for download...');
      const downloadPromise = page.waitForEvent('download', { timeout: 120000 });
      const download = await downloadPromise;
      await download.saveAs(targetFilePath);
      console.log('Download completed. File saved to:', targetFilePath);
    }

    console.log('=== AUTOMATED EXPORT SUCCESSFUL ===');
  } catch (error) {
    console.error('=== AUTOMATED EXPORT FAILED ===');
    console.error(error);
    process.exit(1);
  } finally {
    if (browser) await browser.close();
  }
})();
