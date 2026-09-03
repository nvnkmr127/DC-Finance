const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key);
supabase.from('settings').select('*').eq('id', 1).single().then(console.log).catch(console.error);
