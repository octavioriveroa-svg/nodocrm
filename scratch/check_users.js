const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://localhost:3000/login');
  await page.fill('input[type="email"]', 'octavio@nodoenergy.com');
  await page.fill('input[type="password"]', '0ct4v10MX');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);

  const profiles = await page.evaluate(async () => {
    const authKey = Object.keys(localStorage).find(k => k.includes('auth-token'));
    const authData = authKey ? JSON.parse(localStorage.getItem(authKey)) : null;
    const token = authData?.access_token;
    const res = await fetch('https://nlqrdxwyxmgdwawedweh.supabase.co/rest/v1/profiles?select=*', {
      headers: {
        'apikey': 'sb_publishable_061-D6eja3O3_EDpJ7O3_g_uXmWDK7_',
        'Authorization': `Bearer ${token}`
      }
    });
    return await res.json();
  });

  console.log('Profiles from Supabase:\n', JSON.stringify(profiles, null, 2));
  await browser.close();
})();
