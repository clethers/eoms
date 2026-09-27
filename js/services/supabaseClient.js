import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
    console.error(
        '[EOMS] Supabase is not configured: VITE_SUPABASE_URL and/or VITE_SUPABASE_ANON_KEY is missing. ' +
        'Copy .env.example to .env, fill in the values from Supabase -> Project Settings -> API, and restart/rebuild.'
    );
}

export const supabase = createClient(url || 'http://missing-supabase-url.invalid', anonKey || 'missing-anon-key');
