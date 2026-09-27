const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  });
  const page = await context.newPage();

  await page.goto('https://www.nodo.energy/login', { waitUntil: 'networkidle' });
  await page.click('input[type="email"]');
  await page.keyboard.type('octavio@nodoenergy.com', { delay: 20 });
  await page.click('input[type="password"]');
  await page.keyboard.type('0ct4v10MX', { delay: 20 });
  await page.click('button[type="submit"]');
  await page.waitForURL('**/admin**', { timeout: 15000 });

  await page.goto('https://www.nodo.energy/admin/proyectos/nuevo', { waitUntil: 'networkidle' });

  // Get all select dropdown options
  const selects = await page.$$('select');
  for (let i = 0; i < selects.length; i++) {
    const opts = await selects[i].$$eval('option', os => os.map(o => ({ value: o.value, text: o.textContent })));
    console.log(`Select ${i}:`, JSON.stringify(opts));
  }

  await browser.close();
})();
