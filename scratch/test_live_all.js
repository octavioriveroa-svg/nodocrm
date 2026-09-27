const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const screenshotsDir = path.join(__dirname, 'screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  console.log('--- 1. LOGGING IN AS ADMIN ---');
  await page.goto('https://www.nodo.energy/login', { waitUntil: 'networkidle' });
  await page.click('input[type="email"]');
  await page.keyboard.type('octavio@nodoenergy.com', { delay: 30 });
  await page.click('input[type="password"]');
  await page.keyboard.type('0ct4v10MX', { delay: 30 });
  await page.click('button[type="submit"]');

  await page.waitForURL('**/admin**', { timeout: 15000 });
  console.log('Logged in successfully! Current URL:', page.url());
  await page.screenshot({ path: path.join(screenshotsDir, 'live_01_admin_dashboard.png'), fullPage: true });

  // ----------------------------------------------------
  // FLOW 1: CONDITIONAL "NODO BUSCA INSTALADOR" (2-STEP WIZARD)
  // ----------------------------------------------------
  console.log('\n--- 2. TESTING "NODO BUSCA INSTALADOR" CONDITIONAL FLOW ---');
  await page.goto('https://www.nodo.energy/admin/proyectos/nuevo', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Fill Step 0
  const projectNameNodoBusca = `QA Test Nodo Busca ${Date.now()}`;
  await page.fill('input[placeholder="Ej: Proyecto Energía Norte"]', projectNameNodoBusca);
  
  // Select first client
  const clientSelect = await page.$('select');
  if (clientSelect) {
    const opts = await page.$$eval('select option', os => os.map(o => o.value).filter(Boolean));
    if (opts.length > 0) {
      await page.selectOption('select', opts[0]);
    }
  }

  // Click "Quiero que Nodo me ayude a encontrar un instalador"
  console.log('Selecting "Quiero que Nodo me ayude a encontrar un instalador"...');
  await page.click('text=Quiero que Nodo me ayude a encontrar un instalador');
  await page.screenshot({ path: path.join(screenshotsDir, 'live_02_nodo_busca_selected.png'), fullPage: true });

  // Click Siguiente
  await page.click('button:has-text("Siguiente")');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(screenshotsDir, 'live_03_nodo_busca_step1_sites_only.png'), fullPage: true });

  // Check Step Indicator
  const stepIndicatorText = await page.textContent('body');
  console.log('Contains 2-step title "Sitios del proyecto" or "Sitios":', stepIndicatorText.includes('Sitios'));

  // ----------------------------------------------------
  // FLOW 2 & 3 & 4: HYBRID INVERTERS, USD CURRENCY & GROSS SAVINGS
  // ----------------------------------------------------
  console.log('\n--- 3. TESTING HYBRID INVERTERS, USD CURRENCY, & GROSS SAVINGS ---');
  await page.goto('https://www.nodo.energy/admin/proyectos/nuevo', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const projectNameHybrid = `QA Test Hybrid BESS USD ${Date.now()}`;
  await page.fill('input[placeholder="Ej: Proyecto Energía Norte"]', projectNameHybrid);

  if (clientSelect) {
    const opts = await page.$$eval('select option', os => os.map(o => o.value).filter(Boolean));
    if (opts.length > 0) {
      await page.selectOption('select', opts[0]);
    }
  }

  // Select "Tenemos la capacidad para realizar la instalación"
  console.log('Selecting "Tenemos la capacidad para realizar la instalación"...');
  await page.click('text=Tenemos la capacidad para realizar la instalación');
  await page.screenshot({ path: path.join(screenshotsDir, 'live_04_epcista_selected.png'), fullPage: true });

  // Click Siguiente to go to Step 1 (Sitios y productos)
  await page.click('button:has-text("Siguiente")');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(screenshotsDir, 'live_05_step1_full_view.png'), fullPage: true });

  // Select site if available
  const siteCheckbox = await page.$('input[type="checkbox"]');
  if (siteCheckbox) {
    await siteCheckbox.check();
    await page.waitForTimeout(1000);
  }

  // Look for Gross Savings input
  console.log('Checking Gross Savings field in Step 1...');
  const grossSavingsLabel = await page.$('text=Ahorro bruto estimado mensual');
  console.log('Found "Ahorro bruto estimado mensual" label:', !!grossSavingsLabel);

  // Click "Agregar producto"
  const addProdBtn = await page.$('button:has-text("Agregar producto")');
  if (addProdBtn) {
    await addProdBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(screenshotsDir, 'live_06_add_product_modal.png'), fullPage: true });

    // Select BESS
    await page.click('button:has-text("BESS")');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(screenshotsDir, 'live_07_bess_form_with_hybrid_checkbox.png'), fullPage: true });

    // Verify hybrid checkbox exists
    const hybridCheckboxLabel = await page.$('text=Inversores híbridos (también manejan FV)');
    console.log('Found "Inversores híbridos (también manejan FV)" checkbox:', !!hybridCheckboxLabel);
  }

  await browser.close();
  console.log('\n--- LIVE VERIFICATION RUN FINISHED SUCCESSFULLY ---');
})();
