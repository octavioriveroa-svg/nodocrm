const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://localhost:3000/login');
  await page.fill('input[type="email"]', 'octavio@nodoenergy.com');
  await page.fill('input[type="password"]', '0ct4v10MX');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
  await page.goto('http://localhost:3000/admin/clientes');
  await page.waitForTimeout(2000);

  const rows = await page.$$eval('table tbody tr', trs => trs.map(tr => tr.innerText.replace(/\n/g, ' | ')));
  console.log('Client rows in /admin/clientes:', rows);

  // Now let's go to /admin/proyectos/nuevo and test selecting Enrique Rivera / Coldtainer
  await page.goto('http://localhost:3000/admin/proyectos/nuevo');
  await page.waitForTimeout(1500);

  // Select Enrique Rivera
  await page.selectOption('select', '5a0a6c17-0703-42a5-b0db-3308504940f3');
  await page.waitForTimeout(1000);

  // Select Coldtainer
  const allSelects = await page.$$('select');
  for (const sel of allSelects) {
    const opts = await sel.$$eval('option', os => os.map(o => o.value));
    if (opts.includes('b3f6a217-8018-4594-8b0f-1e044317633c')) {
      await sel.selectOption('b3f6a217-8018-4594-8b0f-1e044317633c');
      console.log('Coldtainer selected');
    }
  }
  await page.waitForTimeout(1000);

  // Select 'Tenemos la capacidad...'
  await page.click('text=Tenemos la capacidad para realizar la instalación');
  await page.fill('input[placeholder="Ej: Proyecto Energía Norte"]', 'Test Coldtainer Project');

  await page.click('button:has-text("Siguiente")');
  await page.waitForTimeout(1500);

  const checkboxes = await page.$$('input[type="checkbox"]');
  console.log(`Checkboxes in Step 1 for Coldtainer: ${checkboxes.length}`);

  const step1Text = await page.locator('body').innerText();
  console.log('Step 1 contains Gross Savings:', step1Text.includes('Ahorro bruto estimado anual'));

  await browser.close();
})();
