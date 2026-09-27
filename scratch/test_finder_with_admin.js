const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });

  await page.goto('http://localhost:3000/login');
  await page.fill('input[type="email"]', 'octavio@nodoenergy.com');
  await page.fill('input[type="password"]', '0ct4v10MX');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);

  // Navigate to /finder/nuevo
  await page.goto('http://localhost:3000/finder/nuevo');
  await page.waitForTimeout(2000);
  console.log('Finder nuevo URL:', page.url());

  // Test 1: Nodo busca instalador flow in Finder portal
  await page.fill('input[placeholder="Ej: Proyecto Energía Norte"]', '[TEST-QA-DELETE-ME] Finder Nodo Busca Test');
  
  // Click 'Quiero que Nodo me ayude a encontrar un instalador'
  await page.click('text=Quiero que Nodo me ayude a encontrar un instalador');
  await page.waitForTimeout(500);

  // Click Siguiente
  await page.click('button:has-text("Siguiente")');
  await page.waitForTimeout(1000);

  const stepLabels = await page.locator('.step-indicator, nav, body').innerText();
  console.log('Step content after clicking Siguiente in Nodo busca mode:\n', stepLabels.slice(0, 300));

  // Test 2: BESS Hybrid and FV notice in Finder portal
  await page.goto('http://localhost:3000/finder/nuevo');
  await page.waitForTimeout(1500);

  await page.fill('input[placeholder="Ej: Proyecto Energía Norte"]', '[TEST-QA-DELETE-ME] Finder BESS Hibrido Test');
  await page.click('text=Tenemos la capacidad para realizar la instalación');
  await page.waitForTimeout(500);

  await page.click('button:has-text("Siguiente")');
  await page.waitForTimeout(1000);

  console.log('Step 1 URL:', page.url());
  const grossVisible = await page.locator('text=Ahorro bruto estimado anual').isVisible();
  console.log('Is Ahorro bruto visible in Step 1?:', grossVisible);

  await browser.close();
})();
