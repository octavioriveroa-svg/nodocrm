const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const screenshotsDir = path.join(__dirname, 'screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('--- STEP 1: LOGGING IN AS ADMIN (octavio@nodoenergy.com) ---');
  await page.goto('https://www.nodo.energy/login', { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', 'octavio@nodoenergy.com');
  await page.fill('input[type="password"]', '0ct4v10MX');
  await page.click('button[type="submit"]');

  await page.waitForTimeout(4000);
  console.log('Current URL after login:', page.url());
  await page.screenshot({ path: path.join(screenshotsDir, '01_after_login.png'), fullPage: true });

  // ----------------------------------------------------
  // TEST SCENARIO A: CONDITIONAL NODO_BUSCA FLOW (2-STEPS)
  // ----------------------------------------------------
  console.log('\n--- TEST SCENARIO A: Testing "Nodo busca instalador" (2-step conditional flow) ---');
  await page.goto('https://www.nodo.energy/admin/proyectos/nuevo', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // Fill Step 0
  const projectNameNodoBusca = `Test QA Nodo Busca ${Date.now()}`;
  await page.fill('input[placeholder="Ej: Proyecto Energía Norte"]', projectNameNodoBusca);
  
  // Select first client from dropdown if available
  const clientSelect = await page.$('select');
  if (clientSelect) {
    const options = await page.$$eval('select option', opts => opts.map(o => o.value).filter(Boolean));
    if (options.length > 0) {
      await page.selectOption('select', options[0]);
    }
  }

  // Select 'nodo_busca'
  console.log('Selecting "Quiero que Nodo me ayude a encontrar un instalador"...');
  await page.click('text=Quiero que Nodo me ayude a encontrar un instalador');
  await page.screenshot({ path: path.join(screenshotsDir, '02_step0_nodo_busca_selected.png'), fullPage: true });

  // Click Next
  await page.click('button:has-text("Siguiente")');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(screenshotsDir, '03_step1_nodo_busca_sites_only.png'), fullPage: true });

  // Verify step indicator and buttons
  const stepText = await page.textContent('body');
  console.log('Checking Step Indicator in Nodo Busca...');
  const hasOnlyTwoSteps = !stepText.includes('Sitios y productos') || stepText.includes('Sitios del proyecto');
  console.log('Sites-only view active:', hasOnlyTwoSteps);

  // ----------------------------------------------------
  // TEST SCENARIO B: HYBRID INVERTERS & GROSS SAVINGS & USD CURRENCY
  // ----------------------------------------------------
  console.log('\n--- TEST SCENARIO B: Testing Hybrid Inverters & Gross Savings & USD Currency ---');
  await page.goto('https://www.nodo.energy/admin/proyectos/nuevo', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  const projectNameHybrid = `Test QA Hybrid BESS USD ${Date.now()}`;
  await page.fill('input[placeholder="Ej: Proyecto Energía Norte"]', projectNameHybrid);

  if (clientSelect) {
    const options = await page.$$eval('select option', opts => opts.map(o => o.value).filter(Boolean));
    if (options.length > 0) {
      await page.selectOption('select', options[0]);
    }
  }

  // Select 'epcista_instala'
  console.log('Selecting "Tenemos la capacidad para realizar la instalación"...');
  await page.click('text=Tenemos la capacidad para realizar la instalación');
  await page.screenshot({ path: path.join(screenshotsDir, '04_step0_epcista_selected.png'), fullPage: true });

  await page.click('button:has-text("Siguiente")');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(screenshotsDir, '05_step1_full_products_view.png'), fullPage: true });

  // Check Gross Savings input
  const ahorroGrossInput = await page.$('input[placeholder="0"]');
  console.log('Gross savings input exists:', !!ahorroGrossInput);

  // Check site checkboxes or add site
  const siteCheckboxes = await page.$$('input[type="checkbox"]');
  console.log(`Found ${siteCheckboxes.length} checkboxes on step 1`);
  if (siteCheckboxes.length > 0) {
    await siteCheckboxes[0].check();
    await page.waitForTimeout(1000);
  }

  await page.screenshot({ path: path.join(screenshotsDir, '06_step1_site_selected.png'), fullPage: true });

  // Click Agregar Producto
  const addProductBtn = await page.$('button:has-text("Agregar producto"), button:has-text("Agregar otro producto")');
  if (addProductBtn) {
    await addProductBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(screenshotsDir, '07_product_type_selector.png'), fullPage: true });

    // Click BESS
    await page.click('button:has-text("BESS")');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(screenshotsDir, '08_bess_form_with_hybrid_checkbox.png'), fullPage: true });

    // Fill BESS Form
    console.log('Filling BESS Form with Hybrid Checkbox checked...');
    const textInputs = await page.$$('input[type="text"]');
    // Fill potency, capacity, brand, capex
    await page.fill('input[placeholder="0"]', '500'); // Potencia
    // Check hybrid checkbox
    const hybridCheckbox = await page.$('input[type="checkbox"]:near(:text("Inversores híbridos"))');
    if (hybridCheckbox) {
      await hybridCheckbox.check();
      console.log('Checked "Inversores híbridos (también manejan FV)"');
    }

    // Select usage
    const usageSelect = await page.$('select');
    if (usageSelect) {
      await usageSelect.selectOption('load_shifting');
    }

    await page.screenshot({ path: path.join(screenshotsDir, '09_bess_form_filled.png'), fullPage: true });
  }

  await browser.close();
  console.log('\n--- BROWSER VERIFICATION RUN FINISHED ---');
})();
