import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://gslccondumevctdfdtyk.supabase.co'
// A chave anônima (anon key) deve ser configurada no arquivo .env
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'COLE_SUA_CHAVE_AQUI_SE_NAO_USAR_ENV'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
