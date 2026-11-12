# RoomieRoomie database

Everything the app needs in Postgres lives here, version-controlled. Spec: `CLAUDE.md` §6–§8.

```
supabase/
  config.toml          local stack config (seed path → seed/dev_seed.sql)
  migrations/          applied in filename order; every file is safe to re-run
    …01_types_tables   enum types + the 10 tables
    …02_indexes        specified indexes + supporting ones
    …03_helpers        private.* helpers (not exposed to the API) + photo/listing integrity triggers
    …04_rls            grants + RLS policies on all 10 tables
    …05_swipes         25 likes/day limit, liked_item check, mutual-like → match trigger
    …06_get_feed       get_feed(p_user_id, p_limit = 20, p_cursor)
    …07_storage        private `photos` bucket + storage policies
    …08_realtime       messages + matches in the supabase_realtime publication
  seed/
    dev_seed.sql       200 fake profiles (DEV/LOCAL ONLY)
    cleanup_seed.sql   deletes every seed user and all their rows
  tests/database/      pgTAP tests (RLS, match trigger, like limit, get_feed)
```

## Option A — Supabase CLI (recommended)

Requires Docker Desktop for the local stack. **CLI 3.x targets the LOCAL database by default —
add `--remote` to act on the linked hosted project.**

```bash
# Local development
npx supabase start                 # first run downloads images; applies migrations + seed
npx supabase db reset              # rebuild local DB from scratch: migrations + seed
npx supabase test db               # run the pgTAP tests
npx supabase db lint               # static checks on functions

# Remote project (dev first, then production)
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push --remote      # applies migrations to the hosted project — never the seed
```

To seed a **dev** remote project (never production):
`npx supabase db push --remote --include-seed` or paste `seed/dev_seed.sql` into the SQL editor.

## Option B — Supabase dashboard SQL editor

1. Open **SQL Editor** in the dashboard.
2. Paste and run each file in `migrations/` **in filename order** (01 → 08). Each one is re-runnable.
3. Dev project only: run `seed/dev_seed.sql`. Remove it later with `seed/cleanup_seed.sql`.

## Google sign-in (current login)

1. **Google Cloud Console** → APIs & Services → Credentials → *Create credentials* → **OAuth client ID** →
   type **Web application**. Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`.
   (First time: configure the OAuth consent screen — app name RoomieRoomie, your email, External.)
2. **Supabase dashboard** → Authentication → Sign In / Providers → **Google** → enable → paste the
   Client ID and Client Secret → Save.
3. Authentication → **URL Configuration** → Redirect URLs → add `exp://**` (Expo Go) and `roomieroomie://**`.

Local stack: Google is off in `config.toml` (needs its own OAuth client with redirect
`http://127.0.0.1:54321/auth/v1/callback`).

## Phone login (paused)

Phone OTP is disabled for now. The `functions/send-sms` hook (MSG91 or Twilio via `SMS_PROVIDER`) is kept
for when phone verification returns: deploy with `npx supabase functions deploy send-sms --no-verify-jwt`,
add it under Authentication → Hooks → Send SMS, and set its secrets (see the function header).

## Test data vs production

- Seed users carry `raw_app_meta_data.seed = true` and phone numbers `+91 99999 0xxxx`.
- The seed refuses to run if the database has more than 50 real (non-seed) users.
- Seed photos are placeholder images from picsum.photos (no real people).
- Use **separate Supabase projects** for dev and production.

## Things the app must know

- Call the feed with `supabase.rpc('get_feed', { p_user_id, p_limit, p_cursor })`; pass the last row's
  `next_cursor` to get the next page. Users can only request their own feed.
- Liking more than 25 times in an IST day raises error message `daily_like_limit_reached` (code `P0001`).
- Photos: upload to bucket `photos` at `<user_id>/<file>.webp`, store that path in `photos.url`, display via
  signed URLs. Seed rows store full `https://` URLs instead.
- Matches are never inserted by the app — the trigger creates them. Unmatch = update `unmatched_at`.
- Mark read = update `messages.read_at` (recipient only).
