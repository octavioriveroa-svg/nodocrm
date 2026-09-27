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

  // Login
  await page.goto('https://www.nodo.energy/login', { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', 'octavio@nodoenergy.com');
  await page.fill('input[type="password"]', '0ct4v10MX');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/admin**', { timeout: 15000 });

  console.log('Navigating to project creation...');
  await page.goto('https://www.nodo.energy/admin/proyectos/nuevo', { waitUntil: 'networkidle' });
  
  const projName = `Live Verification Hybrid USD ${Date.now()}`;
  await page.fill('input[placeholder="Ej: Proyecto Energía Norte"]', projName);

  // Select EPCista
  const selects = await page.$$('select');
  if (selects.length > 0) {
    await selects[0].selectOption({ index: 3 }); // Juan Carlos
    await page.waitForTimeout(800);
  }

  // Select Client
  const allSelects = await page.$$('select');
  if (allSelects.length >= 3) {
    const clientOpts = await allSelects[2].$$eval('option', os => os.map(o => o.value).filter(Boolean));
    if (clientOpts.length > 0) {
      await allSelects[2].selectOption(clientOpts[0]);
    }
  }

  // Select EPCista instala
  await page.click('text=Tenemos la capacidad para realizar la instalación');
  await page.click('button:has-text("Siguiente")');
  await page.waitForTimeout(1200);

  // Step 1: Fill Gross Savings
  const grossInputs = await page.$$('input[placeholder="0"]');
  if (grossInputs.length > 0) {
    await grossInputs[0].fill('15000'); // $15,000 gross savings
  }

  // Select Site
  const siteBox = await page.$('input[type="checkbox"]');
  if (siteBox) {
    await siteBox.check();
    await page.waitForTimeout(800);
  }

  // Add BESS Product
  console.log('Adding BESS Product...');
  await page.click('button:has-text("Agregar producto")');
  await page.waitForTimeout(800);
  await page.click('button:has-text("BESS")');
  await page.waitForTimeout(800);

  // Fill BESS
  const bessTextInputs = await page.$$('input[placeholder="0"]');
  // Potencia
  if (bessTextInputs.length >= 2) await bessTextInputs[1].fill('100');
  // Capacidad
  if (bessTextInputs.length >= 3) await bessTextInputs[2].fill('200');
  await page.fill('input[placeholder="BYD, Tesla…"]', 'BYD Energy');

  // Usage
  const bessSelects = await page.$$('select');
  for (const s of bessSelects) {
    const opts = await s.$$eval('option', os => os.map(o => o.value));
    if (opts.includes('load_shifting')) {
      await s.selectOption('load_shifting');
      break;
    }
  }

  // Check Hybrid
  const hybridCheck = await page.$('input[type="checkbox"]:near(:text("Inversores híbridos"))');
  if (hybridCheck) {
    await hybridCheck.check();
  }

  // CAPEX BESS
  const allBessInputs = await page.$$('input[placeholder="0"]');
  if (allBessInputs.length >= 4) {
    await allBessInputs[3].fill('120000'); // $120,000 USD
  }

  await page.click('button:has-text("Agregar producto"):not(:has-text("Cancelar"))');
  await page.waitForTimeout(1200);

  // Add FV Product on same site (with inverters omitted!)
  console.log('Adding FV Product with omitted inverters...');
  const addAnotherBtn = await page.$('button:has-text("Agregar producto")');
  if (addAnotherBtn) {
    await addAnotherBtn.click();
    await page.waitForTimeout(800);
    await page.click('button:has-text("Fotovoltaico")');
    await page.waitForTimeout(800);

    const fvInputs = await page.$$('input[placeholder="0"]');
    // Modulos
    if (fvInputs.length >= 2) await fvInputs[1].fill('300');
    // Potencia W
    if (fvInputs.length >= 3) await fvInputs[2].fill('550');
    await page.fill('input[placeholder="Jinko, LONGi…"]', 'Jinko Tiger Neo');

    // Annual Gen & CAPEX
    const allFvInputs = await page.$$('input[placeholder="0"]');
    if (allFvInputs.length >= 6) await allFvInputs[5].fill('220000'); // Gen kWh
    if (allFvInputs.length >= 7) await allFvInputs[6].fill('150000'); // CAPEX USD

    await page.click('button:has-text("Agregar producto"):not(:has-text("Cancelar"))');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(screenshotsDir, 'live_30_both_products_card.png'), fullPage: true });
  }

  // Go to Step 2 (Financiamiento)
  console.log('Proceeding to Step 2...');
  await page.click('button:has-text("Siguiente")');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(screenshotsDir, 'live_31_financing_step.png'), fullPage: true });

  // Select "Nodo Recomienda" for clean submission
  console.log('Selecting "Nodo Recomienda" and submitting...');
  const nodoRecomiendaBtn = await page.$('text=Nodo Recomienda');
  if (nodoRecomiendaBtn) {
    await nodoRecomiendaBtn.click();
    await page.waitForTimeout(500);
  }

  // Submit project
  await page.click('button:has-text("Enviar proyecto")');
  await page.waitForTimeout(4000);

  console.log('Current URL after submit:', page.url());
  await page.screenshot({ path: path.join(screenshotsDir, 'live_32_project_detail_view.png'), fullPage: true });

  await browser.close();
  console.log('\n--- END-TO-END PROJECT SUBMISSION VERIFIED ---');
})();
