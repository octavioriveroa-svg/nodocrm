const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://localhost:3000/login');
  await page.fill('input[type="email"]', 'octavio@nodoenergy.com');
  await page.fill('input[type="password"]', '0ct4v10MX');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);

  await page.goto('http://localhost:3000/admin/proyectos/nuevo');
  await page.waitForTimeout(2000);

  const finderSelect = page.locator('label:has-text("Finder / Originador") + select');
  const finderOptions = await finderSelect.locator('option').allInnerTexts();
  console.log('Finder Options in Select:', finderOptions);

  await browser.close();
})();
