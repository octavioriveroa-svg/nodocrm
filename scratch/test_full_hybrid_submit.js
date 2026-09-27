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
        console.error(`Supabase REST Error [${resp.status()}] on ${resp.url()}`);
      }
    }
  });

  // Login
  await page.goto('https://www.nodo.energy/login', { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', 'octavio@nodoenergy.com');
  await page.fill('input[type="password"]', '0ct4v10MX');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/admin**', { timeout: 15000 });

  console.log('Navigating to project creation for full hybrid + savings test...');
  await page.goto('https://www.nodo.energy/admin/proyectos/nuevo', { waitUntil: 'networkidle' });
  
  const projName = `QA Hybrid USD Savings ${Date.now()}`;
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
    await grossInputs[0].fill('28500'); // $28,500 gross monthly savings
  }

  // Select Site
  const siteBox = await page.$('input[type="checkbox"]');
  if (siteBox) {
    await siteBox.check();
    await page.waitForTimeout(800);
  }

  // 1. Add BESS Product
  console.log('Adding BESS Product with Hybrid Inverter checked...');
  await page.click('button:has-text("Agregar producto")');
  await page.waitForTimeout(800);
  await page.click('button:has-text("BESS")');
  await page.waitForTimeout(800);

  const bessTextInputs = await page.$$('input[placeholder="0"]');
  if (bessTextInputs.length >= 2) await bessTextInputs[1].fill('150'); // Potencia kW
  if (bessTextInputs.length >= 3) await bessTextInputs[2].fill('300'); // Capacidad kWh
  await page.fill('input[placeholder="BYD, Tesla…"]', 'Tesla Megapack 2XL');

  // Select usage
  const bessSelects = await page.$$('select');
  for (const s of bessSelects) {
    const opts = await s.$$eval('option', os => os.map(o => o.value));
    if (opts.includes('load_shifting_ups')) {
      await s.selectOption('load_shifting_ups');
      break;
    }
  }

  // Check Hybrid Inverters
  const hybridCheck = await page.$('input[type="checkbox"]:near(:text("Inversores híbridos"))');
  if (hybridCheck) {
    await hybridCheck.check();
    console.log('Checked "Inversores híbridos (también manejan FV)"');
  }

  // CAPEX BESS: $250,000 USD
  const allBessInputs = await page.$$('input[placeholder="0"]');
  if (allBessInputs.length >= 4) {
    await allBessInputs[3].fill('250000');
  }

  await page.click('button:has-text("Agregar producto"):not(:has-text("Cancelar"))');
  await page.waitForTimeout(1200);

  // 2. Add FV Product with NO inverters
  console.log('Adding FV Product (bypassing inverter inputs due to hybrid BESS)...');
  const addAnotherBtn = await page.$('button:has-text("Agregar producto")');
  if (addAnotherBtn) {
    await addAnotherBtn.click();
    await page.waitForTimeout(800);
    await page.click('button:has-text("Fotovoltaico")');
    await page.waitForTimeout(800);

    const fvInputs = await page.$$('input[placeholder="0"]');
    if (fvInputs.length >= 2) await fvInputs[1].fill('500'); // 500 panels
    if (fvInputs.length >= 3) await fvInputs[2].fill('580'); // 580 W
    await page.fill('input[placeholder="Jinko, LONGi…"]', 'LONGi Hi-MO 6');

    // Skip inverters completely!
    const allFvInputs = await page.$$('input[placeholder="0"]');
    if (allFvInputs.length >= 6) await allFvInputs[5].fill('420000'); // Gen kWh
    if (allFvInputs.length >= 7) await allFvInputs[6].fill('180000'); // CAPEX $180,000 USD

    await page.screenshot({ path: path.join(screenshotsDir, 'live_50_fv_hybrid_form.png'), fullPage: true });

    await page.click('button:has-text("Agregar producto"):not(:has-text("Cancelar"))');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(screenshotsDir, 'live_51_both_cards.png'), fullPage: true });
  }

  // Proceed to Step 2
  console.log('Proceeding to Step 2 (Financiamiento)...');
  await page.click('button:has-text("Siguiente")');
  await page.waitForTimeout(1500);

  // Select Nodo Recomienda
  const nodoRecomiendaBtn = await page.$('text=Nodo Recomienda');
  if (nodoRecomiendaBtn) {
    await nodoRecomiendaBtn.click();
    await page.waitForTimeout(500);
  }

  // Submit
  console.log('Submitting project...');
  await page.click('button:has-text("Enviar proyecto")');
  await page.waitForTimeout(5000);

  console.log('Final URL after submit:', page.url());
  await page.screenshot({ path: path.join(screenshotsDir, 'live_52_hybrid_project_detail.png'), fullPage: true });

  await browser.close();
  console.log('\n--- FULL HYBRID + SAVINGS + USD TEST COMPLETED ---');
})();
