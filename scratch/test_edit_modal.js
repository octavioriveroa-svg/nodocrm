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

  const projectUrl = 'https://www.nodo.energy/admin/proyectos/8f607b84-293d-47a2-800c-ee5b15687264';
  await page.goto(projectUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Click "Editar Solución Técnica"
  console.log('Opening "Editar Solución Técnica" modal...');
  await page.click('button:has-text("Editar Solución Técnica")');
  await page.waitForTimeout(1500);

  await page.screenshot({ path: path.join(screenshotsDir, 'live_70_edit_modal_open.png'), fullPage: true });
  console.log('Saved screenshot of edit modal!');

  await browser.close();
})();
