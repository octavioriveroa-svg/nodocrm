const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://nlqrdxwyxmgdwawedweh.supabase.co';
const ANON_KEY = 'sb_publishable_061-D6eja3O3_EDpJ7O3_g_uXmWDK7_';

const supabase = createClient(SUPABASE_URL, ANON_KEY);

(async () => {
  const { data, error } = await supabase.from('profiles').select('id, nombre, rol');
  console.log('Profiles with anon key:', data, error);
})();
