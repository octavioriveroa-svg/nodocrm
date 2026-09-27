const { chromium } = require('playwright');

const accounts = [
  { email: 'epc@prueba.com', pass: 'EPCISTA', role: 'EPC' },
  { email: 'analista@prueba.com', pass: 'ANALISTA', role: 'Analista' },
  { email: 'mauro@eurolatinagroup.com', pass: 'Eurolatina1', role: 'EPC' },
  { email: 'financiero@prueba.com', pass: 'Financiero123', role: 'Financiero' },
  { email: 'cliente@prueba.com', pass: 'Cliente123', role: 'Cliente' },
  { email: 'suministrador@prueba.com', pass: 'Suministrador123', role: 'Supply' }
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  for (const acc of accounts) {
    console.log(`Trying login for ${acc.email}...`);
    await page.goto('https://www.nodo.energy/login', { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', acc.email);
    await page.fill('input[type="password"]', acc.pass);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    const currentUrl = page.url();
    console.log(`Result for ${acc.email}: ${currentUrl}`);
    if (!currentUrl.includes('/login')) {
      console.log(`>>> SUCCESSFUL LOGIN WITH: ${acc.email} (${acc.role}) -> ${currentUrl}`);
      break;
    }
  }

  await browser.close();
})();
