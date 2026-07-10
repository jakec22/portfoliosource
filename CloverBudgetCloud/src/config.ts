// Supabase project config. This prototype ships with NO real project wired
// up — these env vars are unset until you create your own (see README.md).
// The anon/publishable key is safe to ship in the client; Row-Level Security
// policies (see supabase/schema.sql) are what actually protect the data.
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const isSupabaseConfigured = SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;
