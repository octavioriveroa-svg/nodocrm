const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const screenshotsDir = path.join(__dirname, 'screenshots');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('Logging in as octavio@nodoenery.com ...');
  await page.goto('https://www.nodo.energy/login', { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', 'octavio@nodoenery.com');
  await page.fill('input[type="password"]', '0ct4v10MX');
  await page.click('button[type="submit"]');

  await page.waitForTimeout(4000);
  console.log('Current URL after login:', page.url());
  await page.screenshot({ path: path.join(screenshotsDir, '20_octavio_login_success.png'), fullPage: true });

  await browser.close();
})();
