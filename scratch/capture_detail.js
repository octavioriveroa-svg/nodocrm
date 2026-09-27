const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const screenshotsDir = path.join(__dirname, 'screenshots');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1200 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  });
  const page = await context.newPage();

  // Login
  await page.goto('https://www.nodo.energy/login', { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', 'octavio@nodoenergy.com');
  await page.fill('input[type="password"]', '0ct4v10MX');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/admin**', { timeout: 15000 });

  // Navigate to created project detail page
  const projectUrl = 'https://www.nodo.energy/admin/proyectos/8f607b84-293d-47a2-800c-ee5b15687264';
  console.log(`Navigating to ${projectUrl}...`);
  await page.goto(projectUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  await page.screenshot({ path: path.join(screenshotsDir, 'live_60_project_detail_full.png'), fullPage: true });
  console.log('Saved screenshot to scratch/screenshots/live_60_project_detail_full.png');

  await browser.close();
})();
