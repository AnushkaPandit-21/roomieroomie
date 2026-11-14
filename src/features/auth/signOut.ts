import { unregisterPushToken } from '@/services/push';
import { getSupabase } from '@/services/supabase';

// Stops pushes to this phone (needs the session for RLS), then signs out.
export async function signOut(userId: string | undefined): Promise<void> {
  if (userId) await unregisterPushToken(userId).catch(() => undefined);
  await getSupabase().auth.signOut();
}
