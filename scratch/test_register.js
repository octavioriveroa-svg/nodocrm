const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const screenshotsDir = path.join(__dirname, 'screenshots');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('Testing registration at https://www.nodo.energy/registro...');
  await page.goto('https://www.nodo.energy/registro', { waitUntil: 'networkidle' });
  
  const testEmail = `qa_epc_${Date.now()}@nodo.energy`;
  await page.fill('input[placeholder="Juan Pérez"]', 'QA Test User');
  await page.fill('input[placeholder="Mi empresa S.A."]', 'QA Energy Corp');
  await page.fill('input[type="email"]', testEmail);
  await page.fill('input[type="password"]', 'Test123456!');

  await page.screenshot({ path: path.join(screenshotsDir, '10_registro_filled.png'), fullPage: true });
  await page.click('button[type="submit"]');

  await page.waitForTimeout(4000);
  console.log('URL after registration submit:', page.url());
  await page.screenshot({ path: path.join(screenshotsDir, '11_after_registration.png'), fullPage: true });

  await browser.close();
})();
