// Profile settings: pause and in-app account deletion. No React Native imports, so the e2e
// scripts use them too.
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database';

type Client = SupabaseClient<Database>;

// Paused profiles are hidden from Discover, Rooms and Likes You; matches and chats keep working.
export async function setPaused(client: Client, userId: string, paused: boolean): Promise<void> {
  const { error } = await client.from('profiles').update({ is_paused: paused }).eq('id', userId);
  if (error) throw error;
}

// Deletes the caller's account, photos and all their data (Edge Function `delete-account`).
export async function deleteAccount(client: Client): Promise<void> {
  const { data, error } = await client.functions.invoke('delete-account', { method: 'POST' });
  if (error) throw error;
  if (!(data as { deleted?: boolean } | null)?.deleted) throw new Error('Account deletion failed.');
}
