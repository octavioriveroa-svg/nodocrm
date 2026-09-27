const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  
  await page.goto('http://localhost:3000/login');
  await page.fill('input[type="email"]', 'octavio@nodoenergy.com');
  await page.fill('input[type="password"]', '0ct4v10MX');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);

  // Go to the created project or first project
  await page.goto('http://localhost:3000/admin/proyectos');
  await page.waitForTimeout(2000);
  const firstProjLink = page.locator('table a[href*="/admin/proyectos/"]').first();
  await firstProjLink.click();
  await page.waitForTimeout(2000);

  console.log('Project detail URL:', page.url());

  // Test Editar Solucion Tecnica
  const editSolBtn = page.locator('button:has-text("Editar Solución Técnica")').first();
  await editSolBtn.click();
  await page.waitForTimeout(1500);

  const modalGrossInput = page.locator('.fixed label:has-text("Ahorro bruto estimado anual") + div input').first();
  console.log('Current prefilled gross savings:', await modalGrossInput.inputValue());

  await modalGrossInput.fill('850000');
  await page.waitForTimeout(500);

  const saveSolBtn = page.locator('.fixed button:has-text("Guardar cambios")').last();
  await saveSolBtn.click();
  await page.waitForTimeout(4000);

  const grossDetailText = await page.locator('div:has-text("Ahorro bruto anual")').last().locator('xpath=..').innerText();
  console.log('Updated gross detail text:', grossDetailText.replace(/\n/g, ' '));

  // Test Editar Financiamiento
  const editFinBtn = page.locator('button:has-text("Editar Opciones de Financiamiento")').first();
  await editFinBtn.click();
  await page.waitForTimeout(1500);

  const modalNetInput = page.locator('.fixed label:has-text("Ahorro neto anual (post-financiamiento)") + div input').first();
  console.log('Current prefilled net savings:', await modalNetInput.inputValue());

  await modalNetInput.fill('650000');
  await page.waitForTimeout(500);

  const saveFinBtn = page.locator('.fixed button:has-text("Guardar cambios")').last();
  await saveFinBtn.click();
  await page.waitForTimeout(4000);

  const finDetailText = await page.locator('span:has-text("Ahorro anual:")').first().locator('xpath=..').innerText();
  console.log('Updated net detail text:', finDetailText.replace(/\n/g, ' '));

  await browser.close();
})();
