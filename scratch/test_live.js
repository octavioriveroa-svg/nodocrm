const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const screenshotsDir = path.join(__dirname, 'screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('Navigating to https://www.nodo.energy/login...');
  await page.goto('https://www.nodo.energy/login', { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(screenshotsDir, '01_login_page.png'), fullPage: true });
  console.log('Login page screenshot saved to scratch/screenshots/01_login_page.png');

  // Check if we can navigate to admin or if it redirects
  await page.goto('https://www.nodo.energy/admin', { waitUntil: 'networkidle' });
  console.log('Current URL after /admin:', page.url());
  await page.screenshot({ path: path.join(screenshotsDir, '02_admin_redirect.png'), fullPage: true });

  await browser.close();
})();
