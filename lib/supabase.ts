
import { createClient } from '@supabase/supabase-js';

const getEnv = (key: string, fallback: string): string => {
    const searchKeys = [`VITE_${key}`, key, key.toUpperCase()];
    try {
        if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
            for (const k of searchKeys) {
                const val = (import.meta as any).env[k];
                if (val) return val.trim();
            }
        }
        if (typeof process !== 'undefined' && process.env) {
            for (const k of searchKeys) {
                const val = process.env[k];
                if (val) return val.trim();
            }
        }
    } catch (e) {}
    return fallback;
}

export const SUPABASE_URL = 'https://xxkafurxhvcclwzabawm.supabase.co';
// Предоставленный ключ Anon (Legacy)
const PROVIDED_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4a2FmdXJ4aHZjY2x3emFiYXdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxNTgxMTIsImV4cCI6MjA4NDczNDExMn0.WX3hF0mf6fFpaVIGWFwthmJgoLO4dSkPZH4L_sgOGpc';

export const SUPABASE_ANON_KEY = getEnv('SUPABASE_ANON_KEY', PROVIDED_KEY);

export const isSupabaseConfigured = true;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
