const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://nlqrdxwyxmgdwawedweh.supabase.co',
  'sb_publishable_061-D6eja3O3_EDpJ7O3_g_uXmWDK7_'
);

async function test() {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'cliente@prueba.com',
    password: 'Cliente123'
  });
  if (authError) {
    console.error('Login Error:', authError);
    return;
  }
  console.log('Logged in as', authData.session.user.id);

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authData.session.user.id)
    .single();

  if (profileError) {
    console.error('Profile Fetch Error:', profileError);
  } else {
    console.log('Profile:', profile);
  }
}

test();
