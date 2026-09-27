const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));

  await page.goto('https://www.nodo.energy/login', { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', 'octavio@nodoenergy.com');
  await page.fill('input[type="password"]', '0ct4v10MX');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/admin**', { timeout: 15000 });

  // Test Supabase query directly from the browser context
  const result = await page.evaluate(async () => {
    // Check configuraciones_tecnicas columns by attempting a select
    const token = localStorage.getItem(Object.keys(localStorage).find(k => k.includes('auth-token')));
    if (!token) return 'No auth token found';
    
    const parsed = JSON.parse(token);
    const jwt = parsed.access_token;

    const res = await fetch('https://nlqrdxwyxmgdwawedweh.supabase.co/rest/v1/configuraciones_tecnicas?select=id,nombre,ahorro_estimado_mensual,ahorro_moneda&limit=1', {
      headers: {
        'apikey': 'sb_publishable_061-D6eja3O3_EDpJ7O3_g_uXmWDK7_',
        'Authorization': `Bearer ${jwt}`
      }
    });

    const json = await res.json();
    return { status: res.status, data: json };
  });

  console.log('Query result on configuraciones_tecnicas:', JSON.stringify(result));
  await browser.close();
})();
