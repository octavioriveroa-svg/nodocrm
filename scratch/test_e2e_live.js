const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://nlqrdxwyxmgdwawedweh.supabase.co';
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5scXJkeHd5eG1nZHdhd2Vkd2VoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTcxNjE5MywiZXhwIjoyMDkxMjkyMTkzfQ.dA4RiMhkqPCmKSNsZNvKtl3_hvzs9yXcPBBc-M3gPtUI').replace(/\s+/g, '');

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

(async () => {
  const screenshotsDir = path.join(__dirname, 'screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  // 1. Find an admin user
  const { data: users, error: userError } = await supabase.auth.admin.listUsers();
  if (userError || !users.users.length) {
    console.error('Could not list users:', userError);
    return;
  }

  // Find admin profile
  const { data: profiles } = await supabase.from('profiles').select('id, nombre, rol').eq('rol', 'nodo_admin');
  console.log('Admin profiles:', profiles);

  let targetUser = users.users.find(u => profiles && profiles.some(p => p.id === u.id));
  if (!targetUser) {
    targetUser = users.users[0];
  }
  console.log('Testing with user:', targetUser.email, targetUser.id);

  // Generate link
  const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: targetUser.email
  });

  if (linkErr) {
    console.error('Error generating link:', linkErr);
    return;
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('Navigating with generated link to authenticate...');
  await page.goto(linkData.properties.action_link, { waitUntil: 'networkidle' });
  console.log('Current URL after auth:', page.url());

  await page.goto('https://www.nodo.energy/admin', { waitUntil: 'networkidle' });
  console.log('Admin page URL:', page.url());
  await page.screenshot({ path: path.join(screenshotsDir, '03_admin_dashboard.png'), fullPage: true });

  // Navigate to New Project
  await page.goto('https://www.nodo.energy/admin/proyectos/nuevo', { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(screenshotsDir, '04_nuevo_proyecto_step0.png'), fullPage: true });

  await browser.close();
})();
