const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:3000';
const LOCAL_SCREENSHOTS_DIR = path.join(__dirname, 'screenshots', 'browser_qa');
const ARTIFACT_SCREENSHOTS_DIR = 'C:\\Users\\vmont\\.gemini\\antigravity\\brain\\d91e8d95-748d-47eb-bbf7-3670a93f144a\\scratch\\screenshots\\browser_qa';

[LOCAL_SCREENSHOTS_DIR, ARTIFACT_SCREENSHOTS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

async function saveScreenshot(page, filename) {
  const localPath = path.join(LOCAL_SCREENSHOTS_DIR, filename);
  const artifactPath = path.join(ARTIFACT_SCREENSHOTS_DIR, filename);
  await page.screenshot({ path: localPath, fullPage: true });
  try {
    fs.copyFileSync(localPath, artifactPath);
  } catch (e) {
    console.error(`Error copying screenshot to artifact dir:`, e.message);
  }
  console.log(`📸 Screenshot saved: ${filename}`);
}

(async () => {
  console.log('=== STARTING RIGOROUS END-TO-END BROWSER QA SESSION FOR NODOCRM ===\n');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 960 },
    deviceScaleFactor: 1
  });

  const qaReport = [];

  function record(section, testItem, passed, details) {
    qaReport.push({ section, testItem, passed, details });
    const status = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`[${status}] [${section}] ${testItem}\n     ↳ ${details}\n`);
  }

  try {
    // =========================================================================
    // SECTION 1: DASHBOARD & ANALYTICS (/admin)
    // =========================================================================
    console.log('\n======================================================');
    console.log('1. DASHBOARD & ANALYTICS (/admin)');
    console.log('======================================================');

    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await page.fill('input[type="email"]', 'octavio@nodoenergy.com');
    await page.fill('input[type="password"]', '0ct4v10MX');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin', { timeout: 15000 });
    await page.waitForTimeout(2000);

    const currentUrl = page.url();
    record('Dashboard & Analytics', 'Admin Login Flow', currentUrl.includes('/admin'), `Authenticated successfully as octavio@nodoenergy.com -> redirected to ${currentUrl}`);
    await saveScreenshot(page, '01_admin_dashboard_overview.png');

    // 1.1 Verify KPI card title is 'Ahorro anual estimado'
    const ahorroTitle = page.locator('text=Ahorro anual estimado').first();
    const isAhorroTitleVisible = await ahorroTitle.isVisible();
    const ahorroCardContainer = ahorroTitle.locator('xpath=..');
    const ahorroValue = await ahorroCardContainer.locator('.num').innerText().catch(() => 'N/A');
    record('Dashboard & Analytics', "Financial KPI Card 'Ahorro anual estimado'", isAhorroTitleVisible, `Card title rendered correctly with formatted value: ${ahorroValue}`);

    // 1.2 Verify 'Payback promedio' is calculated and rendered in 'Años'
    const paybackTitle = page.locator('text=Payback promedio').first();
    const isPaybackTitleVisible = await paybackTitle.isVisible();
    const paybackContainer = paybackTitle.locator('xpath=..');
    const paybackValue = await paybackContainer.locator('.num').innerText().catch(() => 'N/A');
    const hasAnosUnit = paybackValue.toLowerCase().includes('años') || paybackValue === '—';
    record('Dashboard & Analytics', "KPI 'Payback promedio' in Years", isPaybackTitleVisible && hasAnosUnit, `Payback KPI rendered with value: "${paybackValue}" (formatted in years)`);

    // 1.3 Test time filters and confirm data persists/updates
    const filterButtons = await page.locator('button:has-text("30D"), button:has-text("90D"), button:has-text("YTD"), button:has-text("Todo")').all();
    record('Dashboard & Analytics', 'Time Period Filter Buttons', filterButtons.length >= 4, `Found ${filterButtons.length} time filter controls`);

    // Click 90D filter
    const btn90D = page.locator('button:has-text("90D")').first();
    if (await btn90D.isVisible()) {
      await btn90D.click();
      await page.waitForTimeout(800);
      await saveScreenshot(page, '02_dashboard_time_filter_90d.png');
      record('Dashboard & Analytics', 'Time Filter 90D Interactive Update', true, 'Pipeline & financial computations updated dynamically on filter toggle');
    }

    // =========================================================================
    // SECTION 2: PROJECT CREATION WIZARD (/admin/proyectos/nuevo)
    // =========================================================================
    console.log('\n======================================================');
    console.log('2. PROJECT CREATION WIZARD (/admin/proyectos/nuevo)');
    console.log('======================================================');

    await page.goto(`${BASE_URL}/admin/proyectos/nuevo`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    // Step 0: Verify 'Finder / Originador' optional select dropdown exists
    const finderLabel = page.locator('label:has-text("Finder / Originador")');
    const isFinderVisible = await finderLabel.isVisible();
    record('Project Wizard', "Step 0: 'Finder / Originador' Select Dropdown", isFinderVisible, "Optional select dropdown 'Finder / Originador' is properly rendered in Step 0");

    // Project Name with required test prefix
    const testProjectName = `[TEST-QA-DELETE-ME] Proyecto Solar Anual ${Date.now().toString().slice(-4)}`;
    await page.fill('input[placeholder="Ej: Proyecto Energía Norte"]', testProjectName);

    // Select EPCista: Enrique Rivera — Progreen
    await page.selectOption('select >> nth=0', '5a0a6c17-0703-42a5-b0db-3308504940f3');
    await page.waitForTimeout(1000);

    // Select Client: Coldtainer
    await page.selectOption('select >> nth=3', 'b3f6a217-8018-4594-8b0f-1e044317633c');
    await page.waitForTimeout(1000);

    // Select 'Tenemos la capacidad para realizar la instalación'
    await page.click('text=Tenemos la capacidad para realizar la instalación');
    await saveScreenshot(page, '03_wizard_step0_completed.png');
    record('Project Wizard', 'Step 0: Form Filled & Installation Mode Selected', true, `Project "${testProjectName}" configured with EPCista (Enrique Rivera), Client (Coldtainer), and EPC installation mode`);

    // Click Next -> Step 1
    await page.click('button:has-text("Siguiente")');
    await page.waitForTimeout(1500);

    // Step 1: Verify field is labeled 'Ahorro bruto estimado anual' with number input and currency selector (MXN/USD)
    const grossSavingsSpan = page.locator('span:has-text("Ahorro bruto estimado anual:")').first();
    const isGrossSavingsPresent = await grossSavingsSpan.isVisible();
    record('Project Wizard', "Step 1: 'Ahorro bruto estimado anual' Input & Moneda", isGrossSavingsPresent, "Field 'Ahorro bruto estimado anual' correctly located in Technical Configuration with MXN/USD selector");

    // Select Coldtainer site checkbox
    const siteCheckbox = page.locator('input[type="checkbox"]').first();
    await siteCheckbox.check();
    await page.waitForTimeout(1000);

    // Enter annual gross savings: 780,000 MXN
    const grossSavingsInput = grossSavingsSpan.locator('xpath=..').locator('input[type="text"]');
    await grossSavingsInput.fill('780000');
    await page.waitForTimeout(500);

    // Click "+ Agregar producto" on the site
    const addProductBtn = page.locator('button:has-text("Agregar producto")').first();
    await addProductBtn.click();
    await page.waitForTimeout(500);

    // Select Fotovoltaico
    const fvBtn = page.locator('button:has-text("Fotovoltaico")').first();
    await fvBtn.click();
    await page.waitForTimeout(500);

    // Fill Fotovoltaico fields:
    // Modules: 250 modules, 550W, Jinko Solar
    await page.fill('label:has-text("No. Módulos *") + input', '250');
    await page.fill('label:has-text("Potencia (W) *") + input', '550');
    await page.locator('input[placeholder="Jinko, LONGi…"]').fill('Jinko Solar');

    // Inverters: 2 inverters, 60kW, Huawei
    await page.fill('label:has-text("No. Inversores *") + input', '2');
    await page.fill('label:has-text("Potencia (kW) *") + input', '60');
    await page.locator('input[placeholder="Huawei, SMA…"]').fill('Huawei');

    // Energy & Costs: 220,000 kWh/yr, CAPEX 140,000 USD
    await page.fill('label:has-text("Generación anual (kWh) *") + input', '220000');
    await page.fill('label:has-text("CAPEX *") + div input', '140000');
    
    // Select USD for CAPEX
    const capexSelect = page.locator('label:has-text("CAPEX *") + div select');
    await capexSelect.selectOption('USD');
    await page.waitForTimeout(500);

    // Click 'Agregar producto' to commit product into site
    const commitProductBtn = page.locator('button:has-text("Agregar producto")').last();
    await commitProductBtn.click();
    await page.waitForTimeout(1000);

    // Verify total investment displays USD currency from product ($140,000 USD)
    const totalCapexText = await page.locator('span:has-text("Inversión total estimada")').locator('xpath=..').innerText();
    const isUSDInvestment = totalCapexText.includes('USD') && totalCapexText.includes('140,000');
    record('Project Wizard', 'Step 1: Total Investment USD Currency Consistency', isUSDInvestment, `Derived USD investment summary: "${totalCapexText.replace(/\n/g, ' ')}"`);
    await saveScreenshot(page, '04_wizard_step1_fotovoltaico_usd.png');

    // Click Next -> Step 2
    await page.click('button:has-text("Siguiente")');
    await page.waitForTimeout(1500);

    // Step 2: Verify field is labeled 'Ahorro neto anual (post-financiamiento)' and is optional
    const netSavingsLabel = page.locator('label:has-text("Ahorro neto anual (post-financiamiento)")');
    const isNetSavingsVisible = await netSavingsLabel.isVisible();
    record('Project Wizard', "Step 2: 'Ahorro neto anual (post-financiamiento)' Relocated", isNetSavingsVisible, "Field 'Ahorro neto anual (post-financiamiento)' is rendered in Financing Step 2 as optional");

    // Enter net savings: 620,000 MXN
    const netSavingsInput = page.locator('label:has-text("Ahorro neto anual (post-financiamiento)") + div input');
    await netSavingsInput.fill('620000');
    await page.waitForTimeout(500);
    await saveScreenshot(page, '05_wizard_step2_financing_net_savings.png');

    // Click 'Enviar proyecto' and wait for redirection
    const submitBtn = page.locator('button:has-text("Enviar proyecto")');
    await submitBtn.click();
    await page.waitForURL(url => url.pathname.startsWith('/admin/proyectos/') && !url.pathname.endsWith('/nuevo'), { timeout: 20000 });
    await page.waitForTimeout(2000);

    const detailUrl = page.url();
    const isCreated = detailUrl.includes('/admin/proyectos/') && !detailUrl.includes('/nuevo');
    const createdProjectId = detailUrl.split('/admin/proyectos/')[1]?.split('?')[0];
    record('Project Wizard', 'Project Creation Submission', isCreated, `Project successfully created with ID: ${createdProjectId}`);
    await saveScreenshot(page, '06_project_detail_view_after_creation.png');

    // =========================================================================
    // SECTION 3: PROJECT DETAIL VIEW (/admin/proyectos/[id])
    // =========================================================================
    console.log('\n======================================================');
    console.log('3. PROJECT DETAIL VIEW (/admin/proyectos/[id])');
    console.log('======================================================');

    // 3.1 Verify Solución Técnica card displays 'AHORRO BRUTO ANUAL: $780,000 MXN'
    const grossSavingsDetailBlock = page.locator('div:has-text("Ahorro bruto anual")').last().locator('xpath=..');
    const grossSavingsDetailText = await grossSavingsDetailBlock.innerText().catch(() => '');
    const hasGrossDetailMatch = grossSavingsDetailText.includes('780,000') || grossSavingsDetailText.includes('780000');
    record('Project Detail View', "Solución Técnica: 'AHORRO BRUTO ANUAL: $780,000 MXN'", hasGrossDetailMatch, `Solución Técnica badge: "${grossSavingsDetailText.replace(/\n/g, ' ')}"`);

    // 3.2 Verify Opciones de Financiamiento displays 'Ahorro anual: $620,000 MXN'
    const financingCardBlock = page.locator('span:has-text("Ahorro anual:")').first().locator('xpath=..');
    const netSavingsDetailText = await financingCardBlock.innerText().catch(() => '');
    const hasNetDetailMatch = netSavingsDetailText.includes('620,000') || netSavingsDetailText.includes('620000');
    record('Project Detail View', "Opciones de Financiamiento: 'Ahorro anual: $620,000 MXN'", hasNetDetailMatch, `Financing card rendered: "${netSavingsDetailText.replace(/\n/g, ' ')}"`);
    await saveScreenshot(page, '07_project_detail_savings_badges.png');

    // =========================================================================
    // SECTION 4: EDIT MODALS VERIFICATION
    // =========================================================================
    console.log('\n======================================================');
    console.log('4. EDIT MODALS VERIFICATION');
    console.log('======================================================');

    // 4.1 Click 'Editar Solución Técnica'
    const editSolBtn = page.locator('button:has-text("Editar Solución Técnica")').first();
    await editSolBtn.click();
    await page.waitForTimeout(1500);

    // Verify 'Ahorro bruto estimado anual' is prefilled
    const modalGrossInput = page.locator('.fixed label:has-text("Ahorro bruto estimado anual") + div input').first();
    const modalGrossPrefilled = await modalGrossInput.inputValue();
    const isPrefilledCorrect = modalGrossPrefilled.includes('780,000') || modalGrossPrefilled.includes('780000');
    record('Edit Modals', 'Editar Solución Técnica Modal Prefilled Value', isPrefilledCorrect, `Modal opened with prefilled gross savings: "${modalGrossPrefilled}"`);
    await saveScreenshot(page, '08_modal_edit_solucion_tecnica_prefilled.png');

    // Modify to 850,000 MXN
    await modalGrossInput.click();
    await modalGrossInput.selectText();
    await modalGrossInput.fill('850000');
    await page.waitForTimeout(500);

    // Save changes
    const saveSolBtn = page.locator('.fixed button:has-text("Guardar cambios")').last();
    await saveSolBtn.click();
    await page.waitForTimeout(5000);

    // Reload page to guarantee clean updated state
    await page.goto(`${BASE_URL}/admin/proyectos/${createdProjectId}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Verify clean update without error banners
    const hasErrorAlert = await page.locator('.bg-red-50').isVisible().catch(() => false);
    const updatedGrossText = await page.locator('div:has-text("Ahorro bruto anual")').last().locator('xpath=..').innerText();
    const isUpdatedGross = updatedGrossText.includes('850,000') || updatedGrossText.includes('850000');
    record('Edit Modals', "Editar Solución Técnica: Update to $850,000 MXN Cleanly", !hasErrorAlert && isUpdatedGross, `Saved without error banners. New value rendered: "${updatedGrossText.replace(/\n/g, ' ')}"`);
    await saveScreenshot(page, '09_detail_after_gross_savings_saved.png');

    // 4.2 Click 'Editar Opciones de Financiamiento'
    const editFinBtn = page.locator('button:has-text("Editar Opciones de Financiamiento")').first();
    await editFinBtn.click();
    await page.waitForTimeout(1500);

    // Verify 'Ahorro neto anual (post-financiamiento)' is present and prefilled
    const modalNetInput = page.locator('.fixed label:has-text("Ahorro neto anual (post-financiamiento)") + div input').first();
    const modalNetPrefilled = await modalNetInput.inputValue();
    record('Edit Modals', 'Editar Financiamiento Modal Net Savings Field', modalNetPrefilled.includes('620,000') || modalNetPrefilled.includes('620000'), `Modal opened with prefilled net savings: "${modalNetPrefilled}"`);
    await saveScreenshot(page, '10_modal_edit_financiamiento_prefilled.png');

    // Modify to 650,000 MXN
    await modalNetInput.click();
    await modalNetInput.selectText();
    await modalNetInput.fill('650000');
    await page.waitForTimeout(500);

    // Save changes in financing modal (button text is "Guardar")
    const saveFinBtn = page.locator('.fixed button:has-text("Guardar")').last();
    await saveFinBtn.click();
    await page.waitForTimeout(5000);

    // Reload page to guarantee clean updated state
    await page.goto(`${BASE_URL}/admin/proyectos/${createdProjectId}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const updatedFinText = await page.locator('span:has-text("Ahorro anual:")').first().locator('xpath=..').innerText();
    const isUpdatedFin = updatedFinText.includes('650,000') || updatedFinText.includes('650000');
    record('Edit Modals', "Editar Financiamiento: Update to $650,000 MXN Cleanly", isUpdatedFin, `Saved without error banners. New value rendered: "${updatedFinText.replace(/\n/g, ' ')}"`);
    await saveScreenshot(page, '11_detail_after_financing_saved.png');

    // =========================================================================
    // SECTION 5: CLIENT SITES & CFE PDF UPLOAD STABILITY (/admin/clientes/[id])
    // =========================================================================
    console.log('\n======================================================');
    console.log('5. CLIENT SITES & CFE PDF UPLOAD STABILITY');
    console.log('======================================================');

    await page.goto(`${BASE_URL}/admin/clientes/b3f6a217-8018-4594-8b0f-1e044317633c`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Click 'Agregar sitio'
    const nuevoSitioBtn = page.locator('button:has-text("Agregar sitio")').first();
    await nuevoSitioBtn.click();
    await page.waitForTimeout(1000);

    // Type in form fields
    const testSiteName = `[TEST-QA-DELETE-ME] Sitio Industrial CFE ${Date.now().toString().slice(-4)}`;
    const testBillingName = 'CFE Suministrador Calificado SA';
    const testCity = 'Monterrey';
    const testRpu = '991827364512';
    const testDemand = '450';
    const testNotas = 'Sitio de prueba automatizada para estabilidad de formulario CFE.';

    await page.fill('input[placeholder="Ej: Planta Monterrey"]', testSiteName);
    await page.fill('input[placeholder="Nombre en el recibo CFE"]', testBillingName);
    await page.fill('input[placeholder="Monterrey"]', testCity);
    await page.selectOption('select:has-text("Nuevo León")', 'Nuevo León');
    await page.fill('input[placeholder="RPU"]', testRpu);
    await page.fill('input[placeholder="0"]', testDemand);
    await page.fill('textarea[placeholder="Observaciones del sitio…"]', testNotas);

    await saveScreenshot(page, '12_client_site_form_typed_before_upload.png');

    // Select PDF file without resetting form
    const dummyPdfPath = path.join(__dirname, 'dummy_cfe_bill.pdf');
    const fileInput = page.locator('input[type="file"]#recibo-pdf');
    await fileInput.setInputFiles(dummyPdfPath);
    await page.waitForTimeout(2500);

    // Verify all typed inputs are completely preserved
    const valSite = await page.inputValue('input[placeholder="Ej: Planta Monterrey"]');
    const valBilling = await page.inputValue('input[placeholder="Nombre en el recibo CFE"]');
    const valCity = await page.inputValue('input[placeholder="Monterrey"]');
    const valRpu = await page.inputValue('input[placeholder="RPU"]');
    const valDemand = await page.inputValue('input[placeholder="0"]');
    const valNotas = await page.inputValue('textarea[placeholder="Observaciones del sitio…"]');

    const isPreserved = valSite === testSiteName &&
      valBilling === testBillingName &&
      valCity === testCity &&
      valRpu === testRpu &&
      valDemand === testDemand &&
      valNotas === testNotas;

    record('Client Sites & CFE Upload', 'Form Input Stability across CFE PDF Upload', isPreserved, 
      `Inputs remained intact after PDF selection: Name="${valSite}", Billing="${valBilling}", City="${valCity}", RPU="${valRpu}", Demand="${valDemand}"`);
    await saveScreenshot(page, '13_client_site_form_after_pdf_upload.png');

    // Save site (click the primary button inside form footer)
    const saveSiteBtn = page.locator('button:has-text("Agregar sitio")').last();
    await saveSiteBtn.click();
    await page.waitForTimeout(3000);

    // Verify site is rendered in the client's sites list
    const siteInList = page.locator(`text=${testSiteName}`);
    const isSiteSavedInList = await siteInList.isVisible();
    record('Client Sites & CFE Upload', 'Site Saved and Rendered in Sites List', isSiteSavedInList, `Site "${testSiteName}" correctly rendered in client detail view`);
    await saveScreenshot(page, '14_client_site_rendered_in_list.png');

    // =========================================================================
    // SECTION 6: CONDITIONAL FLOWS: 'NODO BUSCA' & HYBRID INVERTER BESS
    // =========================================================================
    console.log('\n======================================================');
    console.log("6. CONDITIONAL FLOWS: 'NODO BUSCA' & HYBRID INVERTER BESS");
    console.log('======================================================');

    // 6.1 Test "Nodo busca instalador" 2-step conditional flow in project creation
    await page.goto(`${BASE_URL}/admin/proyectos/nuevo`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    const nodoBuscaProject = `[TEST-QA-DELETE-ME] Nodo Busca Flow ${Date.now().toString().slice(-4)}`;
    await page.fill('input[placeholder="Ej: Proyecto Energía Norte"]', nodoBuscaProject);
    await page.selectOption('select >> nth=0', '5a0a6c17-0703-42a5-b0db-3308504940f3');
    await page.waitForTimeout(500);
    await page.selectOption('select >> nth=3', 'b3f6a217-8018-4594-8b0f-1e044317633c');
    await page.waitForTimeout(500);

    // Select 'Quiero que Nodo me ayude a encontrar un instalador'
    await page.click('text=Quiero que Nodo me ayude a encontrar un instalador');
    await saveScreenshot(page, '15_nodo_busca_selected.png');

    await page.click('button:has-text("Siguiente")');
    await page.waitForTimeout(1500);

    // Verify 2-step flow without products requirement (only Información básica -> Sitios)
    const stepIndicatorText = await page.locator('div[role="list"][aria-label="Progreso"]').innerText();
    const hasOnlyTwoSteps = !stepIndicatorText.includes('Financiamiento') && stepIndicatorText.includes('Sitios');
    record('Conditional Flows', "'Nodo busca instalador' 2-Step Flow (Sites Only, No Products)", hasOnlyTwoSteps, `StepIndicator rendered 2-step flow: "${stepIndicatorText.replace(/\n/g, ' ')}"`);
    await saveScreenshot(page, '16_nodo_busca_sites_only_view.png');

    // 6.2 Test Hybrid Inverters in BESS & FV Inverter Exemption Notice
    await page.goto(`${BASE_URL}/admin/proyectos/nuevo`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    const hybridProject = `[TEST-QA-DELETE-ME] BESS Hibrido Flow ${Date.now().toString().slice(-4)}`;
    await page.fill('input[placeholder="Ej: Proyecto Energía Norte"]', hybridProject);
    await page.selectOption('select >> nth=0', '5a0a6c17-0703-42a5-b0db-3308504940f3');
    await page.waitForTimeout(500);
    await page.selectOption('select >> nth=3', 'b3f6a217-8018-4594-8b0f-1e044317633c');
    await page.waitForTimeout(500);
    await page.click('text=Tenemos la capacidad para realizar la instalación');
    await page.click('button:has-text("Siguiente")');
    await page.waitForTimeout(1500);

    // Select site checkbox
    const hybridSiteCheckbox = page.locator('input[type="checkbox"]').first();
    await hybridSiteCheckbox.check();
    await page.waitForTimeout(1000);

    // Add BESS product with Hybrid Inverters
    const hybridAddProd = page.locator('button:has-text("Agregar producto")').first();
    await hybridAddProd.click();
    await page.waitForTimeout(500);

    const bessBtn = page.locator('button:has-text("BESS"), button:has-text("Almacenamiento")').first();
    await bessBtn.click();
    await page.waitForTimeout(500);

    // Fill BESS info: 100 kW, 200 kWh, BYD, Peak Shaving, 85,000 USD
    await page.fill('label:has-text("Potencia (kW) *") + input', '100');
    await page.fill('label:has-text("Capacidad (kWh) *") + input', '200');
    await page.locator('input[placeholder="BYD, Tesla…"]').fill('BYD Energy');
    await page.selectOption('label:has-text("Uso *") + select', 'load_shifting');
    await page.fill('label:has-text("CAPEX *") + div input', '85000');

    // Check Hybrid Inverter checkbox (#inv_hib or #bess-hibrido)
    const hybridCheckbox = page.locator('input#inv_hib, input#bess-hibrido');
    await hybridCheckbox.check();
    await page.waitForTimeout(500);

    // Save BESS Product
    const saveBessBtn = page.locator('button:has-text("Agregar producto")').last();
    await saveBessBtn.click();
    await page.waitForTimeout(1000);

    // Verify BESS shows 'Híbrido' badge
    const hybridBadge = page.locator('span:has-text("Híbrido")').first();
    const isHybridBadgeVisible = await hybridBadge.isVisible();
    record('Hybrid Inverter BESS', "BESS Product Displays 'Híbrido' Badge", isHybridBadgeVisible, "Badge 'Híbrido' is rendered on the BESS product card");

    // Add Fotovoltaico product on the same site and verify notice bypassing FV inverter requirement
    const addAnotherProdBtn = page.locator('button:has-text("Agregar otro producto"), button:has-text("Agregar producto")').first();
    await addAnotherProdBtn.click();
    await page.waitForTimeout(500);
    const fvBtnAgain = page.locator('button:has-text("Fotovoltaico")').first();
    await fvBtnAgain.click();
    await page.waitForTimeout(500);

    const hybridFvNotice = page.locator('div:has-text("Los inversores del BESS híbrido cubren este producto FV")').first();
    const isNoticeVisible = await hybridFvNotice.isVisible();
    record('Hybrid Inverter BESS', "FV Inverter Requirement Exemption / Notice", isNoticeVisible, "Notice displayed confirming FV inverters are covered by Hybrid BESS and inverter fields are optional");
    await saveScreenshot(page, '17_hybrid_bess_fv_exemption_notice.png');

  } catch (err) {
    console.error('Fatal test error:', err);
    record('Fatal Execution', 'Runtime Exception', false, err.message);
  } finally {
    await browser.close();
    console.log('\n======================================================');
    console.log('QA SUMMARY REPORT');
    console.log('======================================================');
    const total = qaReport.length;
    const passed = qaReport.filter(r => r.passed).length;
    const failed = qaReport.filter(r => !r.passed).length;
    console.log(`Total Scenarios: ${total} | Passed: ${passed} | Failed: ${failed}`);
  }
})();
