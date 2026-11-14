// Report / block. No React Native imports, so the e2e scripts use it too.
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database';

type Client = SupabaseClient<Database>;

export const REPORT_REASONS = [
  'Fake profile or catfishing',
  'Inappropriate photos',
  'Harassment or abusive messages',
  'Scam, or asking for money or deposits',
  'Under 18',
  'Something else',
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

const isDuplicate = (error: { code?: string } | null) => error?.code === '23505';

// A report also hides the person from my feed, Rooms and Likes You (feed hard filter 6).
export async function reportUser(client: Client, reporterId: string, targetId: string, reason: string): Promise<void> {
  const { error } = await client
    .from('reports_blocks')
    .insert({ reporter_id: reporterId, target_id: targetId, type: 'report', reason: reason.trim().slice(0, 500) });
  if (error && !isDuplicate(error)) throw error;
}

// Blocked users vanish from each other everywhere, including matches and chat.
export async function blockUser(client: Client, reporterId: string, targetId: string): Promise<void> {
  const { error } = await client.from('reports_blocks').insert({ reporter_id: reporterId, target_id: targetId, type: 'block' });
  if (error && !isDuplicate(error)) throw error;
}
