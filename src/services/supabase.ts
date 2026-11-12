import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

import { env } from '@/constants/env';
import type { Database } from '@/types/database';

let client: SupabaseClient<Database> | null = null;

// Created lazily so the app shell runs before .env is filled in; the first real call fails loudly instead.
export function getSupabase(): SupabaseClient<Database> {
  if (client) return client;

  const { supabaseUrl, supabaseAnonKey } = env;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Supabase is not configured. Copy .env.example to .env and set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.',
    );
  }

  const created = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });

  AppState.addEventListener('change', (state) => {
    if (state === 'active') created.auth.startAutoRefresh();
    else created.auth.stopAutoRefresh();
  });

  client = created;
  return created;
}
