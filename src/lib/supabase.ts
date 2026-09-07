import { createClient } from '@supabase/supabase-js';

const getEnv = (key: string): string => {
    const searchKeys = [`VITE_${key}`, key];
    try {
        if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
            for (const k of searchKeys) {
                const val = (import.meta as any).env[k];
                if (val) return val.trim();
            }
        }
    } catch (e) {}
    throw new Error(`Missing required environment variable: ${key}`);
}

export const SUPABASE_URL = getEnv('SUPABASE_URL');
export const SUPABASE_ANON_KEY = getEnv('SUPABASE_ANON_KEY');

export const isSupabaseConfigured = !!SUPABASE_URL && !!SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
