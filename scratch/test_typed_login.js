const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const screenshotsDir = path.join(__dirname, 'screenshots');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  // Listen to network responses
  page.on('response', async response => {
    if (response.url().includes('supabase.co/auth/v1/token')) {
      console.log('Supabase Auth Response Status:', response.status());
      try {
        const body = await response.json();
        console.log('Supabase Auth Response Body:', JSON.stringify(body));
      } catch (e) {}
    }
  });

  console.log('Navigating to https://www.nodo.energy/login ...');
  await page.goto('https://www.nodo.energy/login', { waitUntil: 'networkidle' });

  await page.click('input[type="email"]');
  await page.keyboard.type('octavio@nodoenergy.com', { delay: 50 });

  await page.click('input[type="password"]');
  await page.keyboard.type('0ct4v10MX', { delay: 50 });

  await page.screenshot({ path: path.join(screenshotsDir, '30_typed_login.png'), fullPage: true });

  await page.click('button[type="submit"]');
  await page.waitForTimeout(5000);

  console.log('URL after submit:', page.url());
  await page.screenshot({ path: path.join(screenshotsDir, '31_after_submit.png'), fullPage: true });

  await browser.close();
})();
