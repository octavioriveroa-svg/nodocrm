const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const screenshotsDir = path.join(__dirname, 'screenshots');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  // Login
  await page.goto('https://www.nodo.energy/login', { waitUntil: 'networkidle' });
  await page.click('input[type="email"]');
  await page.keyboard.type('octavio@nodoenergy.com', { delay: 30 });
  await page.click('input[type="password"]');
  await page.keyboard.type('0ct4v10MX', { delay: 30 });
  await page.click('button[type="submit"]');
  await page.waitForURL('**/admin**', { timeout: 15000 });

  // ----------------------------------------------------
  // TEST 1: NODO BUSCA (2-STEPS FLOW)
  // ----------------------------------------------------
  console.log('\n--- 1. TESTING NODO BUSCA FLOW WITH MANUAL CLIENT ---');
  await page.goto('https://www.nodo.energy/admin/proyectos/nuevo', { waitUntil: 'networkidle' });
  await page.fill('input[placeholder="Ej: Proyecto Energía Norte"]', `QA Nodo Busca ${Date.now()}`);

  // Click "Ingresar datos manualmente"
  await page.click('text=Ingresar datos manualmente');
  await page.waitForTimeout(500);

  // Fill manual client fields
  await page.fill('input[placeholder="Nombre del cliente o contacto principal *"]', 'Empresa Solar Demo');
  await page.fill('input[placeholder="Nombre de la empresa *"]', 'Industrias Demo S.A.');
  await page.fill('input[placeholder="correo@empresa.com o 55 1234 5678 *"]', 'demo@industrias.com');

  // Select Nodo Busca
  await page.click('text=Quiero que Nodo me ayude a encontrar un instalador');
  await page.screenshot({ path: path.join(screenshotsDir, 'live_10_step0_nodo_busca_ready.png'), fullPage: true });

  // Next -> Step 1 (Sitios)
  await page.click('button:has-text("Siguiente")');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(screenshotsDir, 'live_11_step1_nodo_busca_sites_active.png'), fullPage: true });

  // ----------------------------------------------------
  // TEST 2: FULL FLOW (HYBRID BESS + GROSS SAVINGS + USD)
  // ----------------------------------------------------
  console.log('\n--- 2. TESTING EPCISTA / HYBRID INVERTERS / GROSS SAVINGS / USD ---');
  await page.goto('https://www.nodo.energy/admin/proyectos/nuevo', { waitUntil: 'networkidle' });
  await page.fill('input[placeholder="Ej: Proyecto Energía Norte"]', `QA Hybrid Solar ${Date.now()}`);

  await page.click('text=Ingresar datos manualmente');
  await page.waitForTimeout(500);

  await page.fill('input[placeholder="Nombre del cliente o contacto principal *"]', 'Cliente Híbrido Test');
  await page.fill('input[placeholder="Nombre de la empresa *"]', 'Comercializadora Norte S.A.');
  await page.fill('input[placeholder="correo@empresa.com o 55 1234 5678 *"]', 'contacto@norte.com');

  // Select EPCista instala
  await page.click('text=Tenemos la capacidad para realizar la instalación');
  await page.click('button:has-text("Siguiente")');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(screenshotsDir, 'live_12_step1_epcista_with_savings.png'), fullPage: true });

  // Add Site inline
  console.log('Adding site inline...');
  await page.click('button:has-text("Agregar sitio"), button:has-text("Agregar otro sitio")');
  await page.waitForTimeout(500);

  await page.fill('input[placeholder="Nombre del sitio *"]', 'Planta Monterrey');
  await page.fill('input[placeholder="Nombre como aparece en el recibo"]', 'Planta Industrial MTY');
  await page.fill('input[placeholder="Ciudad"]', 'Monterrey');
  await page.fill('input[placeholder="RPU"]', '123456789012');
  await page.fill('input[placeholder="Demanda contratada (kW)"]', '500');

  // Save site
  await page.click('button:has-text("Agregar sitio"):not(:has-text("Agregar otro"))');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(screenshotsDir, 'live_13_site_created.png'), fullPage: true });

  // Select the newly created site checkbox
  const siteCheckbox = await page.$('input[type="checkbox"]');
  if (siteCheckbox) {
    await siteCheckbox.check();
    await page.waitForTimeout(1000);
  }
  await page.screenshot({ path: path.join(screenshotsDir, 'live_14_site_selected.png'), fullPage: true });

  // Add BESS Product with Hybrid Inverters
  console.log('Adding BESS Product...');
  const addProdBtn = await page.$('button:has-text("Agregar producto")');
  if (addProdBtn) {
    await addProdBtn.click();
    await page.waitForTimeout(500);
    await page.click('button:has-text("BESS")');
    await page.waitForTimeout(500);

    await page.fill('input[placeholder="0"]', '250'); // Potencia
    // Capacity
    const numInputs = await page.$$('input[placeholder="0"]');
    if (numInputs.length > 1) {
      await numInputs[1].fill('500'); // Capacidad kWh
    }
    await page.fill('input[placeholder="BYD, Tesla…"]', 'Tesla Megapack');
    
    // Check Hybrid Inverter
    const hybridCheckbox = await page.$('input[type="checkbox"]:near(:text("Inversores híbridos"))');
    if (hybridCheckbox) {
      await hybridCheckbox.check();
      console.log('Checked Inversores híbridos!');
    }

    // CAPEX BESS
    if (numInputs.length > 2) {
      await numInputs[2].fill('200000'); // $200,000 USD
    }

    await page.screenshot({ path: path.join(screenshotsDir, 'live_15_bess_form_filled.png'), fullPage: true });
    await page.click('button:has-text("Agregar producto"):not(:has-text("Cancelar"))');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(screenshotsDir, 'live_16_bess_card_displayed.png'), fullPage: true });
  }

  // Now Add FV Product on the SAME site to verify hybrid validation bypass!
  console.log('Adding FV Product on the same site...');
  const addAnotherProdBtn = await page.$('button:has-text("Agregar producto")');
  if (addAnotherProdBtn) {
    await addAnotherProdBtn.click();
    await page.waitForTimeout(500);
    await page.click('button:has-text("Fotovoltaico")');
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(screenshotsDir, 'live_17_fv_form_with_hybrid_notice.png'), fullPage: true });

    // Fill only modules and CAPEX (LEAVING INVERTERS EMPTY!)
    const fvInputs = await page.$$('input[placeholder="0"]');
    if (fvInputs.length >= 1) await fvInputs[0].fill('200'); // No. Modulos
    if (fvInputs.length >= 2) await fvInputs[1].fill('550'); // Potencia W
    await page.fill('input[placeholder="Jinko, LONGi…"]', 'LONGi Solar');

    // Skip inverters completely!
    // Fill Generation & CAPEX
    const allTextInputs = await page.$$('input[placeholder="0"]');
    // Annual generation
    if (allTextInputs.length >= 5) await allTextInputs[4].fill('150000');
    // CAPEX
    if (allTextInputs.length >= 6) await allTextInputs[5].fill('120000');

    await page.screenshot({ path: path.join(screenshotsDir, 'live_18_fv_form_empty_inverters.png'), fullPage: true });

    // Click Agregar Producto
    await page.click('button:has-text("Agregar producto"):not(:has-text("Cancelar"))');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(screenshotsDir, 'live_19_both_products_card_view.png'), fullPage: true });
  }

  // Fill Gross Savings in Step 1
  console.log('Filling Gross Savings in Step 1...');
  const grossInput = await page.$('input[placeholder="0"]');
  if (grossInput) {
    await grossInput.fill('45000');
  }

  // Next -> Step 2 (Financiamiento)
  console.log('Going to Step 2 (Financiamiento)...');
  await page.click('button:has-text("Siguiente")');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(screenshotsDir, 'live_20_step2_financing_view.png'), fullPage: true });

  await browser.close();
  console.log('\n--- FULL LIVE TESTS COMPLETE ---');
})();
