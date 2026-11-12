// Photo storage helpers shared by onboarding, Discover and later screens. No React Native imports.
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database';

export const PHOTO_BUCKET = 'photos';

const SIGNED_URL_SECONDS = 60 * 60;

export const isRemoteUrl = (value: string) => /^https?:\/\//.test(value);

// Signed URLs for private storage paths; full http(s) URLs (seed data) pass through unchanged.
export async function signPhotoUrls(
  client: SupabaseClient<Database>,
  paths: string[],
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  paths.filter(isRemoteUrl).forEach((p) => (result[p] = p));
  const storagePaths = [...new Set(paths.filter((p) => !isRemoteUrl(p)))];
  if (!storagePaths.length) return result;

  const { data, error } = await client.storage.from(PHOTO_BUCKET).createSignedUrls(storagePaths, SIGNED_URL_SECONDS);
  if (error) throw error;
  data?.forEach((s) => {
    if (s.path && s.signedUrl) result[s.path] = s.signedUrl;
  });
  return result;
}
