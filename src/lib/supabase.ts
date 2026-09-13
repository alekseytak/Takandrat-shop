
import { createClient } from '@supabase/supabase-js';

declare const process: any;

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

// Адрес проекта Supabase. По умолчанию — боевой, но его можно подменить
// через окружение (VITE_SUPABASE_URL), не правя код: это нужно, чтобы
// поднять магазин на своём проекте и проверить каталог до публикации.
export const SUPABASE_URL = getEnv('SUPABASE_URL', 'https://xxkafurxhvcclwzabawm.supabase.co');
// Предоставленный ключ Anon (Legacy)
const PROVIDED_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4a2FmdXJ4aHZjY2x3emFiYXdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxNTgxMTIsImV4cCI6MjA4NDczNDExMn0.WX3hF0mf6fFpaVIGWFwthmJgoLO4dSkPZH4L_sgOGpc';

export const SUPABASE_ANON_KEY = getEnv('SUPABASE_ANON_KEY', PROVIDED_KEY);

export const isSupabaseConfigured = true;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // Магазин не пользуется Supabase Auth: покупатель опознаётся по Telegram
    // initData, а таблицы читаются с anon-ключом под RLS. Хранимая сессия и
    // автообновление токена здесь ничего не дают, зато держат блокировку
    // gotrue: если инициализация авторизации не отпускает её за 5 секунд,
    // каталог висит на «СКАНИРОВАНИЕ ИНВЕНТАРЯ…» бесконечно.
    persistSession: false,
    autoRefreshToken: false,
  },
});
