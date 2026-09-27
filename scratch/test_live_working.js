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
  await page.click('input[type="email"]');
  await page.keyboard.type('octavio@nodoenergy.com', { delay: 20 });
  await page.click('input[type="password"]');
  await page.keyboard.type('0ct4v10MX', { delay: 20 });
  await page.click('button[type="submit"]');
  await page.waitForURL('**/admin**', { timeout: 15000 });

  // ------------------------------------------------------------------
  // TEST 1: NODO BUSCA INSTALADOR CONDITIONAL 2-STEP FLOW
  // ------------------------------------------------------------------
  console.log('\n--- 1. Testing "Nodo busca instalador" (2-step flow) ---');
  await page.goto('https://www.nodo.energy/admin/proyectos/nuevo', { waitUntil: 'networkidle' });
  
  await page.fill('input[placeholder="Ej: Proyecto Energía Norte"]', `QA Test Nodo Busca ${Date.now()}`);

  // Select EPCista
  const selects = await page.$$('select');
  if (selects.length > 0) {
    await selects[0].selectOption({ index: 3 }); // Juan Carlos
    await page.waitForTimeout(1000);
  }

  // Select Client
  const allSelects = await page.$$('select');
  if (allSelects.length >= 3) {
    const clientOpts = await allSelects[2].$$eval('option', os => os.map(o => o.value).filter(Boolean));
    if (clientOpts.length > 0) {
      await allSelects[2].selectOption(clientOpts[0]);
    }
  }

  // Select Nodo Busca
  console.log('Selecting "Quiero que Nodo me ayude a encontrar un instalador"...');
  await page.click('text=Quiero que Nodo me ayude a encontrar un instalador');
  await page.screenshot({ path: path.join(screenshotsDir, 'live_01_nodo_busca_selected.png'), fullPage: true });

  // Click Siguiente -> Step 1
  await page.click('button:has-text("Siguiente")');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(screenshotsDir, 'live_02_nodo_busca_step1.png'), fullPage: true });

  // ------------------------------------------------------------------
  // TEST 2: FULL PRODUCT FLOW (HYBRID INVERTERS + GROSS SAVINGS + USD)
  // ------------------------------------------------------------------
  console.log('\n--- 2. Testing Hybrid Inverters, Gross Savings & USD Currency ---');
  await page.goto('https://www.nodo.energy/admin/proyectos/nuevo', { waitUntil: 'networkidle' });
  await page.fill('input[placeholder="Ej: Proyecto Energía Norte"]', `QA Test Hybrid Solar USD ${Date.now()}`);

  const selects2 = await page.$$('select');
  if (selects2.length > 0) {
    await selects2[0].selectOption({ index: 3 }); // Juan Carlos
    await page.waitForTimeout(1000);
  }

  const allSelects2 = await page.$$('select');
  if (allSelects2.length >= 3) {
    const clientOpts = await allSelects2[2].$$eval('option', os => os.map(o => o.value).filter(Boolean));
    if (clientOpts.length > 0) {
      await allSelects2[2].selectOption(clientOpts[0]);
    }
  }

  // Select EPCista instala
  console.log('Selecting "Tenemos la capacidad para realizar la instalación"...');
  await page.click('text=Tenemos la capacidad para realizar la instalación');
  await page.click('button:has-text("Siguiente")');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(screenshotsDir, 'live_03_full_step1.png'), fullPage: true });

  // Check site checkboxes
  const siteBoxes = await page.$$('input[type="checkbox"]');
  console.log(`Found ${siteBoxes.length} site checkboxes`);
  if (siteBoxes.length > 0) {
    await siteBoxes[0].check();
    await page.waitForTimeout(1000);
  }
  await page.screenshot({ path: path.join(screenshotsDir, 'live_04_site_selected.png'), fullPage: true });

  // Add BESS Product
  const addProdBtn = await page.$('button:has-text("Agregar producto")');
  if (addProdBtn) {
    console.log('Clicking "Agregar producto"...');
    await addProdBtn.click();
    await page.waitForTimeout(1000);
    await page.click('button:has-text("BESS")');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(screenshotsDir, 'live_05_bess_form.png'), fullPage: true });

    // Check Hybrid Inverter
    const hybridCheckbox = await page.$('input[type="checkbox"]:near(:text("Inversores híbridos"))');
    if (hybridCheckbox) {
      await hybridCheckbox.check();
      console.log('Checked "Inversores híbridos (también manejan FV)"!');
    }

    await page.screenshot({ path: path.join(screenshotsDir, 'live_06_hybrid_checkbox_checked.png'), fullPage: true });
  }

  await browser.close();
  console.log('\n--- VERIFICATION COMPLETED ---');
})();
