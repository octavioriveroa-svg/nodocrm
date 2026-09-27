const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const screenshotsDir = path.join(__dirname, 'screenshots');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  });
  const page = await context.newPage();

  console.log('Logging in on local server http://localhost:3001 ...');
  await page.goto('http://localhost:3001/login', { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', 'octavio@nodoenergy.com');
  await page.fill('input[type="password"]', '0ct4v10MX');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/admin**', { timeout: 15000 });

  console.log('Logged in! URL:', page.url());
  await page.screenshot({ path: path.join(screenshotsDir, 'search_01_dashboard.png'), fullPage: true });

  // Test 1: Global shortcut Ctrl+K
  console.log('Testing Ctrl+K shortcut...');
  await page.keyboard.press('Control+KeyK');
  await page.waitForTimeout(500);

  // Test 2: Typing query "Hybrid"
  console.log('Typing "Hybrid" into search bar...');
  await page.keyboard.type('Hybrid', { delay: 60 });
  await page.waitForTimeout(1000); // Wait for debounce & results

  await page.screenshot({ path: path.join(screenshotsDir, 'search_02_results_dropdown.png'), fullPage: true });

  // Test 3: Keyboard navigation (ArrowDown)
  console.log('Pressing ArrowDown and Enter to select project...');
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(screenshotsDir, 'search_03_item_highlighted.png'), fullPage: true });

  await page.keyboard.press('Enter');
  await page.waitForTimeout(3000);

  console.log('Navigated to project detail page! Current URL:', page.url());
  await page.screenshot({ path: path.join(screenshotsDir, 'search_04_project_navigated.png'), fullPage: true });

  // Test 4: Another search query "Progreso"
  console.log('Testing second search query "Progreso"...');
  await page.fill('input[placeholder*="Buscar proyectos"]', 'Progreso');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(screenshotsDir, 'search_05_search_progreso.png'), fullPage: true });

  await browser.close();
  console.log('\n--- SEARCH BAR VERIFICATION FINISHED SUCCESSFULLY ---');
})();
