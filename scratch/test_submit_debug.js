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

  page.on('response', async resp => {
    if (resp.url().includes('supabase.co/rest')) {
      if (resp.status() >= 400) {
        console.error(`Supabase REST Error [${resp.status()}] on ${resp.url()}:`);
        try {
          const body = await resp.text();
          console.error(`Error Body:`, body);
        } catch (e) {}
      } else {
        console.log(`Supabase REST Success [${resp.status()}] on ${resp.url()}`);
      }
    }
  });

  page.on('pageerror', err => console.error('PAGE ERROR:', err.message));
  page.on('console', msg => {
    if (msg.type() === 'error') console.error('CONSOLE ERROR:', msg.text());
  });

  // Login
  await page.goto('https://www.nodo.energy/login', { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', 'octavio@nodoenergy.com');
  await page.fill('input[type="password"]', '0ct4v10MX');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/admin**', { timeout: 15000 });

  console.log('Testing project submission...');
  await page.goto('https://www.nodo.energy/admin/proyectos/nuevo', { waitUntil: 'networkidle' });
  
  await page.fill('input[placeholder="Ej: Proyecto Energía Norte"]', `QA Live Check ${Date.now()}`);

  const selects = await page.$$('select');
  if (selects.length > 0) {
    await selects[0].selectOption({ index: 3 }); // Juan Carlos
    await page.waitForTimeout(800);
  }

  const allSelects = await page.$$('select');
  if (allSelects.length >= 3) {
    const clientOpts = await allSelects[2].$$eval('option', os => os.map(o => o.value).filter(Boolean));
    if (clientOpts.length > 0) {
      await allSelects[2].selectOption(clientOpts[0]);
    }
  }

  // Select Nodo Busca (simple flow first!)
  await page.click('text=Quiero que Nodo me ayude a encontrar un instalador');
  await page.click('button:has-text("Siguiente")');
  await page.waitForTimeout(1200);

  // Select Site
  const siteBox = await page.$('input[type="checkbox"]');
  if (siteBox) {
    await siteBox.check();
    await page.waitForTimeout(800);
  }

  console.log('Submitting Nodo Busca project...');
  await page.click('button:has-text("Enviar proyecto")');
  await page.waitForTimeout(5000);

  console.log('Final URL after submit:', page.url());
  await page.screenshot({ path: path.join(screenshotsDir, 'live_40_after_nodo_busca_submit.png'), fullPage: true });

  await browser.close();
})();
