// EXPO_PUBLIC_* values are inlined at build time, so they must be read with static dot access.
export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
} as const;
