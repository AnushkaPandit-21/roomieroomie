// Push notifications for new likes, matches and messages (CLAUDE.md §8), sent through Expo Push
// (APNs + FCM). Called by the database webhook triggers in migration 15 (pg_net), never by the app.
//
// Secrets (supabase secrets set ...):
//   PUSH_WEBHOOK_SECRET   same value as the Vault secret `push_webhook_secret`
//   EXPO_ACCESS_TOKEN     optional; only needed if "enhanced push security" is on in Expo
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by the Edge runtime.
//
// `?dry=1` (with the secret) computes the notifications without sending them, for tests.
import { createClient } from 'npm:@supabase/supabase-js@2';

type Row = Record<string, unknown>;
type Payload = { type: 'swipes' | 'matches' | 'messages'; record: Row };
type Note = { to: string; title: string; body: string; data: Record<string, string> };

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing secret ${name}`);
  return value;
}

const admin = () => createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
type Admin = ReturnType<typeof admin>;

const truncate = (text: string, max = 80) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

async function firstName(db: Admin, id: string): Promise<string> {
  const { data } = await db.from('profiles').select('name').eq('id', id).maybeSingle();
  return data?.name ?? 'Someone';
}

async function isBlocked(db: Admin, a: string, b: string): Promise<boolean> {
  const { count } = await db
    .from('reports_blocks')
    .select('id', { count: 'exact', head: true })
    .eq('type', 'block')
    .or(`and(reporter_id.eq.${a},target_id.eq.${b}),and(reporter_id.eq.${b},target_id.eq.${a})`);
  return (count ?? 0) > 0;
}

// Who gets what, per event. Returns [recipient profile id, notification without `to`].
async function plan(db: Admin, { type, record }: Payload): Promise<Array<[string, Omit<Note, 'to'>]>> {
  if (type === 'swipes') {
    if (record.action !== 'like') return [];
    const swiper = String(record.swiper_id);
    const target = String(record.target_id);
    // A like that completed a match is announced by the match notification instead.
    const [a, b] = swiper < target ? [swiper, target] : [target, swiper];
    const { data: match } = await db.from('matches').select('id').eq('user_a', a).eq('user_b', b).maybeSingle();
    if (match || (await isBlocked(db, swiper, target))) return [];
    return [[target, { title: 'Someone liked you', body: 'Open Likes You to see who.', data: { type: 'like' } }]];
  }

  if (type === 'matches') {
    const a = String(record.user_a);
    const b = String(record.user_b);
    const matchId = String(record.id);
    const [nameA, nameB] = await Promise.all([firstName(db, a), firstName(db, b)]);
    const note = (other: string) => ({
      title: 'It’s a match!',
      body: `You and ${other} liked each other. Say hi!`,
      data: { type: 'match', matchId },
    });
    return [
      [a, note(nameB)],
      [b, note(nameA)],
    ];
  }

  if (type === 'messages') {
    const matchId = String(record.match_id);
    const sender = String(record.sender_id);
    const { data: match } = await db.from('matches').select('user_a, user_b, unmatched_at').eq('id', matchId).maybeSingle();
    if (!match || match.unmatched_at) return [];
    const recipient = match.user_a === sender ? match.user_b : match.user_a;
    if (await isBlocked(db, sender, recipient)) return [];
    const name = await firstName(db, sender);
    // The app hides this while the recipient has that chat open.
    return [[recipient, { title: name, body: truncate(String(record.body ?? '')), data: { type: 'message', matchId } }]];
  }

  return [];
}

async function sendToExpo(db: Admin, notes: Note[]): Promise<number> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
  const token = Deno.env.get('EXPO_ACCESS_TOKEN');
  if (token) headers.Authorization = `Bearer ${token}`;

  let sent = 0;
  for (let i = 0; i < notes.length; i += 100) {
    const batch = notes.slice(i, i + 100);
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(batch.map((n) => ({ ...n, sound: 'default', priority: 'high', channelId: 'default' }))),
    });
    if (!res.ok) {
      console.error('Expo push failed', res.status, await res.text());
      continue;
    }
    const { data } = (await res.json()) as { data: Array<{ status: string; details?: { error?: string } }> };
    // Forget tokens for uninstalled apps.
    const dead = batch.filter((_, k) => data[k]?.details?.error === 'DeviceNotRegistered').map((n) => n.to);
    if (dead.length) await db.from('push_tokens').delete().in('token', dead);
    sent += data.filter((t) => t.status === 'ok').length;
  }
  return sent;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  if (req.headers.get('x-webhook-secret') !== env('PUSH_WEBHOOK_SECRET')) return json({ error: 'unauthorized' }, 401);

  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'invalid JSON' }, 400);
  }

  const db = admin();
  const planned = await plan(db, payload);
  if (!planned.length) return json({ notifications: [], sent: 0 });

  const { data: tokens, error } = await db
    .from('push_tokens')
    .select('profile_id, token')
    .in('profile_id', [...new Set(planned.map(([id]) => id))]);
  if (error) return json({ error: error.message }, 500);

  const notes: Note[] = planned.flatMap(([recipient, note]) =>
    (tokens ?? []).filter((t) => t.profile_id === recipient).map((t) => ({ ...note, to: t.token })),
  );
  const recipients = planned.map(([id, n]) => ({ id, title: n.title, body: n.body, data: n.data }));

  if (new URL(req.url).searchParams.get('dry') === '1') return json({ notifications: recipients, tokens: notes.length, sent: 0 });
  const sent = notes.length ? await sendToExpo(db, notes) : 0;
  return json({ notifications: recipients, tokens: notes.length, sent });
});
