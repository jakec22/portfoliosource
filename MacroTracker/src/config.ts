// USDA FoodData Central API key.
// Override in production by setting EXPO_PUBLIC_USDA_API_KEY in your env
// (e.g. an .env file or EAS secret) rather than committing a key.
export const USDA_API_KEY =
  process.env.EXPO_PUBLIC_USDA_API_KEY ?? 'HbENOuxmhtIwHucqosZty91Inot1dACSnrJNNJGF';

// Supabase project. The anon/publishable key is safe to ship in the client —
// Row-Level Security policies (defined in the DB) are what protect user data.
// Prefer setting these via EXPO_PUBLIC_* env vars (.env) over the fallbacks.
export const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://dnbgpbrixcqooedhhhed.supabase.co';

export const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  'sb_publishable_jqBzGgPboooHWKv_JJ_tCw_PoqcgOWU';
