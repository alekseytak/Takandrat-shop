
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Для Backend используем те же переменные или SERVICE_ROLE_KEY для обхода RLS,
// если это безопасно и сервер находится в надежной среде (Render).
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('ERROR: Supabase URL or Key missing in Backend Envs');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
