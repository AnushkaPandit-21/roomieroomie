// In-app account deletion (App Store + Google Play requirement; DPDP Act 2023): removes every photo
// file, then the auth user. Deleting the auth user cascades to the profile and all rows that
// reference it (preferences, photos, prompts, listing, swipes, matches, messages, reports, tokens).
//
// Called by the signed-in app with its own JWT (verify_jwt = true), so it only deletes the caller.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by the Edge runtime.
import { createClient } from 'npm:@supabase/supabase-js@2';

const PHOTO_BUCKET = 'photos';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const jwt = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!jwt) return json({ error: 'unauthorized' }, 401);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });
  const { data: auth, error: authError } = await admin.auth.getUser(jwt);
  if (authError || !auth.user) return json({ error: 'unauthorized' }, 401);
  const userId = auth.user.id;

  // Photo files live under <user_id>/ (D15). Remove them in pages until the folder is empty.
  for (;;) {
    const { data: files, error } = await admin.storage.from(PHOTO_BUCKET).list(userId, { limit: 100 });
    if (error) return json({ error: `could not list photos: ${error.message}` }, 500);
    if (!files?.length) break;
    const { error: removeError } = await admin.storage.from(PHOTO_BUCKET).remove(files.map((f) => `${userId}/${f.name}`));
    if (removeError) return json({ error: `could not delete photos: ${removeError.message}` }, 500);
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) return json({ error: `could not delete account: ${deleteError.message}` }, 500);

  return json({ deleted: true });
});
