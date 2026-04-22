import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://gslccondumevctdfdtyk.supabase.co'
// A chave anônima (anon key) deve ser configurada no arquivo .env
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'COLE_SUA_CHAVE_AQUI_SE_NAO_USAR_ENV'

let supabase;
try {
  supabase = createClient(supabaseUrl, supabaseAnonKey)
} catch (e) {
  console.error("Supabase Error", e);
  supabase = {
    from: () => ({ select: () => ({ data: [], error: e }), insert: () => ({ select: () => ({ data: null, error: e }) }), update: () => ({ eq: () => ({ select: () => ({ data: null, error: e }) }) }), delete: () => ({ eq: () => ({}) }) })
  };
  window.SUPABASE_INIT_ERROR = e.message;
}

export { supabase };
