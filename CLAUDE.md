# CLAUDE.md — Hinge for Roommates

## 0. Governing rules (read first, always apply)

### 0.1 Source of truth
- `Hinge_Roommates_System_Design.pdf` (project root, dated Nov 12, 2026, by @Manan) is the **single source of truth** for this application. This file restates it; if this file and the PDF ever disagree, the PDF wins and this file must be corrected.
- **No product or technology decision may be changed without explicit approval from the project owner.** This covers features, screens, navigation, onboarding order, schema (tables, columns, enums), indexes, RLS rules, matching filters and weights, limits, the tech stack and libraries, and v1 scope/exclusions.
- Do not remove, reinterpret, simplify, replace or invent functionality. If something is ambiguous or unspecified, **stop and ask** — do not guess. Open questions are tracked in §16.
- Whenever an implementation decision is approved by the owner, **update this CLAUDE.md in the same session** (record it in §15 "Approved decisions log" and in the relevant section) so every new session starts informed.

### 0.2 Permanent coding rules
- TypeScript everywhere. Small, reusable components. Typed Supabase client (generated DB types).
- Use **Expo Router, NativeWind, TanStack Query, Zustand and Supabase**. Do not substitute alternatives.
- **Never expose secrets in client code.** The Supabase service-role key lives only in Edge Functions, never in the app. Secrets go in `.env`; refer to them by variable name only; never paste secret keys into prompts or commit them.
- **Enable Row Level Security on every table**, with policies so users can only read/write what they're allowed to.
- **No hardcoded mock data in production flows.** (Seed scripts for development and load-testing — §11, §13 — are allowed but must stay out of production code paths.)
- Do filtering in SQL; never download all profiles to the phone.
- Paginate everything.
- Do not write application code until the owner asks for it. Plan first; don't code until the plan is approved.

### 0.3 Branding
- Copy Hinge's **interaction patterns** only (vertical profile card, liking a specific photo or prompt, tab layout).
- Use **our own name, logo, colours and copy**. Never use Hinge's logo, assets, name or branding — App Store rule 4.1 (Copycats) rejects apps that mimic another app's branding, and Hinge's logo and assets are trademarked.
- Design direction (from build plan): inspired by Hinge's clean, minimal style but with our own brand — own name, colours, serif headings + sans body, rounded cards, large photos.

### 0.4 v1 exclusions (do NOT build in v1)
- Payments / premium
- Video calls
- ID verification
- Web version
- (Selfie verification badge is explicitly **v2**.)

---

## 1. Product overview & MVP scope

A native **iOS + Android** app built with **React Native (Expo)** on a **Supabase** backend. It handles **1,000 users** comfortably and scales to **tens of thousands** without a rewrite. The app matches people looking for a **PG or flat roommate in the same city** (Indian cities), using **hard filters (city, gender rules, budget)** plus a **lifestyle compatibility score**.

### Two kinds of users
- **Seekers** — need a roommate *and* a place. (`seeking_type = need_place`)
- **Hosts** — already have a room/flat and need someone to fill it. (`seeking_type = have_place`) They show up in the normal feed *and* in the Rooms tab.

### MVP must-haves
- Phone-number sign-up *(owner change 2026-11-13: Google sign-in for now — see §15)*, onboarding with at least 3 photos, max budget, area, move-in date and lifestyle preferences
- Tinder-style gender controls: who you want to live with, and who your profile is shown to
- Hinge-style Discover feed: one full profile at a time, Like (optionally on a specific photo/answer, with a comment) or Cross
- Likes You, Matches + real-time chat, Rooms tab (replaces Standouts), Profile/edit
- Report, block, unmatch, delete account

**Not in v1:** payments/premium, video calls, ID verification, web version.

---

## 2. Screens & navigation

Five bottom tabs, mirroring Hinge's layout with Standouts swapped for Rooms: **Discover, Rooms, Likes You, Matches, Profile**.

| Tab | What the user sees | Key actions |
|---|---|---|
| **Discover** | One profile at a time, scrolled vertically: photos interleaved with prompt answers and a lifestyle chip row (budget, area, veg/non-veg, smoking, drinking, move-in date), plus a match % | Heart a specific photo/prompt (optional comment), big X to cross, filter icon |
| **Rooms** | Hosts with a room available: room photos, rent, deposit, area, available-from, occupancy, plus host's mini profile | Filter by area/rent/date, "I'm interested" (counts as a like) |
| **Likes You** | Grid/list of people who liked you, with the photo/prompt they liked and their comment | Open profile → Like back (instant match) or Cross |
| **Matches** | Chat list sorted by latest message; new matches row on top | Chat, unmatch, report, block |
| **Profile** | Your profile preview, edit mode, preferences, settings | Edit photos/prompts/prefs, pause profile, delete account |

### Screen-level requirements (from the build plan)
- **ProfileCard component:** vertical scroll of photos interleaved with prompts, a lifestyle chip row, and the match %. Each photo/prompt has a heart button that opens a "Like with comment" sheet. A floating X to cross.
- **Discover:** uses `get_feed` with pagination and optimistic updates. Filter sheet (areas, budget, move-in).
- **Likes You:** shows who liked me with the item they liked and their comment; tapping opens their full ProfileCard with Like back / Cross. Liking back must create the match via the trigger and show an **"It's a match"** screen.
- **Matches:** new-matches row on top, conversations list below sorted by latest message with a **"Your turn"** badge.
- **Chat screen:** Supabase Realtime, read receipts, pagination of older messages, and unmatch/report/block in the menu. Safety tips card before the first chat (§10).
- **Rooms:** listing creation for `have_place` users (room photos, rent, deposit, area, available_from, occupancy, amenities). Browse with filters; "I'm interested" counts as a like on the host. Never show exact address before a match.
- **Profile/settings:** edit profile, pause profile, in-app account deletion.

---

## 3. Onboarding flow

One question per screen, Hinge-style, **with a progress bar**. Exact order:

1. Phone OTP *(owner change 2026-11-13: Google sign-in — see §15)*
2. Name & date of birth (**18+**)
3. Your gender
4. Who you want to live with (`want_genders`, multi-select)
5. Who can see you (`show_to_genders`, multi-select)
6. City & preferred areas
7. Seeking a place or have a place (`need_place` / `have_place`)
8. Max budget & move-in date (budget slider)
9. Lifestyle: food, smoking, drinking, sleep schedule, cleanliness, guests, pets, work/study
10. Mark dealbreakers
11. Occupation
12. 3–6 photos (photo picker requiring **at least 3**; compress to **1080px WebP** before upload)
13. 3 prompts
14. (Hosts only) Room listing

Rules:
- Gender, `want_genders` and `show_to_genders` are multi-select (values: `male`, `female`, `non_binary`; own gender is a single value).
- **Users can't reach the tabs until the profile is complete.**
- A profile does not go live until it has **≥ 3 non-room photos**.

UI reference tip (from PDF): the Mobbin connector includes real app screens; searching it for dating-app profile and onboarding flows gives concrete UI references.

---

## 4. Tech stack

One TypeScript codebase for both phones, and a managed backend so we write almost no server code.

| Layer | Choice | Why |
|---|---|---|
| Mobile app | React Native + Expo (TypeScript), Expo Router | One codebase → iOS + Android; test instantly on your phone with Expo Go |
| UI | NativeWind (Tailwind for RN), Reanimated, expo-image | Smooth Hinge-like animations, cached images |
| State/data | TanStack Query + Zustand | Caching, pagination, optimistic likes |
| Auth | Supabase Auth — phone OTP (via Twilio/MSG91) — *currently Google OAuth, see §15* | Indian users expect phone login; cuts fake accounts |
| Database | Supabase Postgres + Row Level Security | Relational data (likes, matches) fits SQL; RLS = security without a server |
| Photos | Supabase Storage + image transforms/CDN | Resize to ~1080px and serve thumbnails |
| Chat | Supabase Realtime (Postgres changes / broadcast) | Live messages without running a socket server |
| Server logic | Supabase Edge Functions + SQL functions | Feed ranking, match creation, push sending |
| Push | Expo Notifications (APNs + FCM) | New like / match / message alerts |
| Builds & release | EAS Build + EAS Submit | Cloud builds for Play Store and App Store without a Mac for Android |
| Monitoring | Sentry (crashes) + PostHog (analytics) | Free tiers cover 1k users |

Considered and rejected: Firebase — matching filters (budget ranges, multi-area, gender rules) are much easier in SQL than in Firestore.

---

## 5. System architecture

- The phone app **never talks to a custom server**: it calls Supabase directly, and **Row Level Security in Postgres decides what each user may read or write.**
- Components: Mobile app (Expo + React Native; iOS and Android; Discover, Rooms, Likes You, Matches and chat, Profile) ↔ Supabase (managed backend):
  - **Auth** — phone OTP login, sessions → SMS provider (**Twilio or MSG91**) for OTP
  - **Postgres + Row Level Security** — `get_feed`, match trigger, 9 tables
  - **Storage + image CDN** — profile and room photos
  - **Realtime** — live chat messages, typing
  - **Edge Functions** — push sending, moderation, limits → **Expo Push** (to APNs + FCM) → like, match and message notifications back to the app
- **Matching logic (`get_feed` and the match trigger) lives in Postgres.**
- **Edge Functions handle anything that needs secret keys**, such as sending pushes and moderating photos.
- **Sentry and PostHog run inside the app** for crash reports and analytics.

---

## 6. Data model

Nine Postgres tables cover the whole MVP, plus `push_tokens`. **Every table has Row Level Security** so users can only read what they're allowed to.

| Table | Key columns | Notes |
|---|---|---|
| `profiles` | `id` (= auth user), `name`, `dob`, `gender`, `want_genders[]`, `show_to_genders[]`, `city`, `areas[]`, `max_budget`, `move_in_date`, `seeking_type` (`need_place` / `have_place`), `occupation`, `bio`, `is_paused`, `last_active_at` | want/show_to are arrays of `male`, `female`, `non_binary` |
| `preferences` | `profile_id`, `food` (veg/non-veg/egg), `smoking`, `drinking`, `sleep` (early/late), `cleanliness` (1–5), `guests`, `pets`, `language[]`, `dealbreakers[]` | dealbreakers = fields that must match exactly |
| `photos` | `id`, `profile_id`, `url`, `position`, `is_room_photo` | Require ≥ 3 non-room photos before profile goes live |
| `prompts` | `id`, `profile_id`, `question`, `answer`, `position` | 3 per profile |
| `listings` | `id`, `host_id`, `area`, `rent`, `deposit`, `available_from`, `occupancy`, `furnished`, `amenities[]`, room photos | Only for `have_place` users; feeds the Rooms tab |
| `swipes` | `swiper_id`, `target_id`, `action` (like/pass), `liked_item` (photo/prompt id), `comment`, `created_at` | Unique on (swiper, target) |
| `matches` | `id`, `user_a`, `user_b`, `created_at`, `unmatched_at` | Created automatically by a trigger on mutual like |
| `messages` | `id`, `match_id`, `sender_id`, `body`, `created_at`, `read_at` | Realtime-subscribed per match |
| `reports_blocks` | `reporter_id`, `target_id`, `type` (report/block), `reason` | Blocked users vanish from each other everywhere |
| `push_tokens` | `profile_id`, `token` | Expo push tokens |

### Indexes that matter
- `profiles(city, gender, is_paused)`
- `swipes(target_id, action)`
- `messages(match_id, created_at)`
- GIN index on `profiles.areas`

### RLS requirements
- RLS enabled on **every** table, including `push_tokens`.
- Users can only read what they're allowed to.
- `messages`: only the two matched users can read or send.
- Blocked users vanish from each other everywhere (feed, Rooms, Likes You, Matches, chat).
- Service-role key only in Edge Functions.

---

## 7. Matching & feed algorithm

The feed runs in two stages: hard filters remove anyone incompatible, then a compatibility score orders the rest. It lives in **one SQL function, `get_feed(user_id, limit 20, cursor)`**, called by the app.

### Stage 1 — hard filters (all must pass)
1. Same city, neither profile paused, both profiles complete (≥ 3 photos).
2. Gender, Tinder-style and two-way: show B to A only if `B.gender ∈ A.want_genders` **and** `A.gender ∈ B.show_to_genders`.
3. Budget overlaps: if B has a place, B's rent share ≤ A's max budget; if both are seekers, budgets within ±30% of each other.
4. Move-in dates within 30 days of each other.
5. No dealbreaker conflict (e.g. A marked "non-smoker only" and B smokes).
6. Not already swiped, not matched, not blocked or reported either way.

### Stage 2 — compatibility score (0–100, shown as "87% match")

| Factor | Weight | How it's scored |
|---|---|---|
| Area overlap | 25 | Shared preferred areas / neighbouring areas |
| Food | 15 | Veg + veg = full; veg + non-veg = low (common PG friction) |
| Smoking & drinking | 20 | Same habit or both "okay with it" |
| Budget closeness | 15 | Closer budgets score higher |
| Sleep & cleanliness | 15 | Same schedule; cleanliness within 1 point |
| Guests, pets, language | 10 | Matching answers |

(Total = 100.)

### Final ranking
Final ranking = score, plus a **small boost** for profiles active in the last 3 days and for people who already liked you (so likes get seen). Hosts with an open listing get a **mild boost** for seekers who `need_place`.

### Likes limit
Cap at ~25 likes/day per user to stop spam-liking; tune later. (Build plan: daily like limit of 25.)

### Feed filter sheet (client)
Areas, budget, move-in.

---

## 8. Likes, matches, chat & notifications

A match is created **by the database itself** the moment two people have liked each other, so it can never be missed or duplicated.

1. A likes B (optionally on a photo/prompt, with a comment) → row in `swipes`.
2. A Postgres trigger checks: has B already liked A? If yes → insert into `matches`, and both get an **"It's a match"** push.
3. If no → B gets a **"Someone liked you"** push, and A appears in B's Likes You tab (with the liked item and comment).
4. Cross = `pass` row; that profile won't reappear (optionally recycle passes after 30 days if the city runs out of people).
5. Chat opens only for matches. Messages are inserted into `messages`; both phones subscribe to that match's channel via Supabase Realtime, so messages arrive instantly. RLS ensures only the two matched users can read or send.
6. A database webhook → Edge Function sends Expo push for new messages when the recipient isn't in the chat.
7. Unmatch sets `unmatched_at`, hides the chat for both; block also removes them from each other's feeds forever.

Rooms: "I'm interested" on a listing counts as a like on the host (goes through the same swipe/match path).

### Extras worth adding early
- Read receipts (`read_at`)
- Typing indicator (Realtime broadcast)
- "Your turn" badge on chats awaiting your reply

### Notifications
Expo push notifications for **new like, new match and new message**, via a Supabase database webhook + Edge Function. Push tokens stored in `push_tokens(profile_id, token)`.

---

## 9. Scaling to 1k+ users & cost

1,000 users is small for this stack; the same design holds to roughly **50k users** with only plan upgrades. What matters:

- **Photos are the biggest cost.** Compress on upload (≤ 1080px, ~200 KB WebP), serve thumbnails in lists. 1k users × 6 photos ≈ 1.2 GB.
- **Paginate everything** — feed in batches of 20, chats load the last 30 messages, infinite scroll upward.
- **Do filtering in SQL**, never download all profiles to the phone.
- **Indexes** listed in the data model; run `EXPLAIN` on `get_feed` once you have seed data.
- **Rate limits** on likes, messages and reports (Edge Function or SQL check).
- **Seed 1,000 fake profiles** with a script to load-test the feed before launch.

### Approximate costs (confirm on each provider's pricing page)
| Item | Approx. cost | Notes |
|---|---|---|
| Supabase | Free to start; Pro ~US$25/month | Move to Pro before launch (no project pausing, daily backups) |
| SMS OTP (Twilio/MSG91) | ~₹0.2–1 per OTP | MSG91 is usually cheaper in India; needs DLT registration |
| Google Play developer account | US$25 one-time | |
| Apple developer program | US$99/year | Needed for App Store |
| Expo EAS | Free tier enough for a few builds/month | |
| Sentry, PostHog | Free tiers | |
| Claude (Pro/Max plan) | Subscription | Claude Code included on paid plans |

---

## 10. Safety, privacy & trust (part of the MVP, not extras)

- **Verified phone numbers** for every account *(paused while login is Google-only — open question §16)*; **18+ check** at sign-up.
- **No exact addresses** on listings before a match — show area/locality only.
- **Report & block** on every profile and chat; reported users **auto-hidden after N reports** pending review.
- **Photo moderation** — run uploads through a moderation API (or manual review at launch) to block nudity and non-person photos. (Runs in Edge Functions.)
- **Selfie verification badge** — **v2** only (fights catfishing).
- **Safety tips card before the first chat:** meet in public, visit the flat together, never pay deposits before seeing the place.
- **Privacy law:** India's **DPDP Act 2023** applies — publish a privacy policy, collect consent, let users download/delete their data.
- **In-app account deletion** is mandatory on both App Store and Google Play; it must remove **all user data and photos**.
- **Secrets:** Supabase service-role key only in Edge Functions, never in the app; RLS on every table.
- Rate limits on likes, messages and reports.

---

## 11. Build plan (feature order)

About 10 focused steps, one feature per step, each followed by testing on a phone. Expect 2–4 weeks part-time.

- **Step 0 — setup:** Node.js LTS, Git, Expo Go on phone; Claude Code; free Supabase project and GitHub repo.
- **1 — Spec file:** this CLAUDE.md. No app code.
- **2 — Scaffold + design system:** plan mode — propose folder structure first and wait for OK. Scaffold Expo app with Expo Router and 5 bottom tabs (Discover, Rooms, Likes You, Matches, Profile) with placeholder screens. Design system with our own brand (name, colours, serif headings + sans body, rounded cards, large photos). Must run in Expo Go.
- **3 — Database:** Supabase SQL migrations for all tables with indexes and RLS policies; mutual-like match trigger; `get_feed` with the hard filters and compatibility score exactly as specified; seed script creating **200 realistic fake profiles across Bengaluru, Pune and Mumbai**; explain how to apply migrations.
- **4 — Auth + onboarding:** phone-OTP login + onboarding (§3) with progress bar; tabs blocked until profile complete.
- **5 — ProfileCard + Discover** (§2).
- **6 — Likes You + matches** (§2, §8).
- **7 — Chat:** Matches tab + chat screen (§2, §8).
- **8 — Rooms tab** + listing creation (§2).
- **9 — Notifications, safety, settings:** push for like/match/message via DB webhook + Edge Function; report/block flows; daily like limit of 25; pause profile; edit profile; in-app account deletion that removes all user data and photos.
- **10 — Hardening + release:** review for bugs, security holes (check every RLS policy) and performance with 1,000+ users; add Sentry and PostHog; tests for `get_feed` gender/budget filters and the match trigger; EAS Build; Google Play internal testing and TestFlight.

## 12. Working loop
- Loop: **plan → build one feature → test on phone (Expo Go) → commit → next**.
- Plan before code; don't code until the plan is approved.
- One feature per session.
- Commit to Git after each working step with a clear message.
- Supabase MCP server may be connected so Claude can apply migrations and inspect tables.
- UI work should be driven by screenshots / Mobbin references.

## 13. Launch checklist
Launch in **one city first (e.g. Bengaluru)** so the feed isn't empty.
- [ ] Pick a name, logo and colours that are our own (name: RoomieRoomie ✔; logo and final colours pending)
- [ ] Supabase on Pro plan, backups on, RLS checked on every table
- [ ] SMS provider set up (DLT registration for India)
- [ ] Privacy policy + terms hosted on a simple webpage
- [ ] In-app account deletion works end to end
- [ ] Seeded/tested with 20–30 real friends; fix top bugs
- [ ] Sentry + PostHog live
- [ ] Google Play internal testing → closed testing (Play requires a testing period for new personal accounts)
- [ ] TestFlight beta → App Store review
- [ ] Seed supply before launch: college groups, PG WhatsApp/Telegram groups, office communities in one city

## 14. Environment / secrets
- Client-safe values only in the app (e.g. Supabase URL and anon key via Expo public env vars).
- Service-role key, SMS provider keys, moderation API keys: Edge Function secrets only.
- `.env` files are never committed.
- Local Supabase (`npx supabase start`) prints well-known demo keys; they are for the local stack only.
- Env vars: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (template in `.env.example`). Read only via `src/constants/env.ts`; the client is created lazily by `getSupabase()` in `src/services/supabase.ts`.

## 14a. Project structure & commands
Expo SDK 58 (React Native 0.88, React 19.3). Also read `AGENTS.md` (Expo's agent guidance: always use `npx expo install`, check versioned Expo docs, never hand-edit `ios/`/`android/`).

```
src/
  app/            Expo Router routes only. (tabs)/ = index (Discover), rooms, likes-you, matches, profile
  components/ui/      Design-system primitives (Text, Button, IconButton, Icon, Card, Chip, Input, Photo, Sheet, ProgressBar, Divider)
  components/layout/  Screen, ScreenHeader, EmptyState
  components/brand/   Wordmark
  constants/      tokens.js (colours/fonts/radius shared with tailwind.config.js), theme.ts, app.ts, env.ts
  hooks/          useResponsive (gutters, type scale, tablet max width)
  services/       supabase.ts, queryClient.ts
  stores/         Zustand stores
  types/          database.ts (generated — never hand-edit), domain.ts (enums derived from it), css.d.ts
  utils/          Small pure helpers (date.ts, cn.ts, math.ts)
  features/onboarding/  steps.ts (order + completeness), validation.ts, answers.ts, api.ts (Supabase I/O),
                        options.ts (choices + PROVISIONAL lists), image.ts (1080px WebP), components/
scripts/          e2e-onboarding.ts — end-to-end onboarding test against the LOCAL stack (npx tsx …)
supabase/
  migrations/     8 re-runnable migrations (tables, indexes, private helpers, RLS, swipes/match trigger, get_feed, storage, realtime)
  seed/           dev_seed.sql (200 fake profiles, dev/local only) + cleanup_seed.sql
  tests/          pgTAP tests (database/*.test.sql) + shared fixtures.psql
  functions/send-sms/   Auth "Send SMS" hook — MSG91 or Twilio via SMS_PROVIDER
  README.md       how to apply via CLI or SQL editor
```

- Supabase CLI 3.x commands target the LOCAL stack by default; use `--remote` for the linked hosted project (e.g. `npx supabase db push --remote`).
- Database workflow: never edit an applied migration — add a new timestamped file. After any schema change run `npx supabase db reset`, `npx supabase test db`, `npx supabase db lint`, `npx supabase db advisors`, then regenerate `src/types/database.ts` (`npx supabase gen types --lang typescript --local --schema public > src/types/database.ts`).
- Server-side helpers live in schema `private` (not exposed to the Data API). Client-callable functions go in `public` with explicit `grant execute ... to authenticated` and `revoke ... from anon`.
- The Supabase client is typed: `SupabaseClient<Database>`.

- Requires **Node.js ≥ 22.13** (SDK 58). Start: `npx expo start` → scan QR with Expo Go.
- Checks before declaring work done: `npx tsc --noEmit`, `npx expo-doctor`.
- Styling: NativeWind **4.2.7** (latest stable) with Tailwind **3.4** (NativeWind 4 does not support Tailwind 4). Use design tokens, never raw hex values in components.
- `src/app/design-system.tsx` is a dev-only preview (redirects to `/` in production builds); linked from Profile only when `__DEV__`.

## 15. Approved decisions log
_Record every owner-approved implementation decision here (date, decision, section affected)._
- 2026-11-12 — App name is **RoomieRoomie** (§0.3, §13). Slug/scheme `roomieroomie`.
- 2026-11-12 — Scaffold approved and built per §11 step 2: Expo SDK 58, Expo Router (JS tabs), NativeWind 4.2.7 + Tailwind 3, Reanimated 4, expo-image, TanStack Query, Zustand, Supabase JS with AsyncStorage session storage. Folder layout as in §14a.
- 2026-11-12 — Initial design system (pending owner review of the visual direction): warm off-white canvas `#FAF7F2`, ink `#1F1A17`, terracotta brand `#C2502E`, deep-green accent `#2F5D50`; serif headings **Fraunces SemiBold**, sans body **Inter** (400/500/600); rounded cards (24px), pill buttons/chips; light mode only.

- 2026-11-12 — **Database (§11 step 3) approved and built.** Schema additions:
  - A1 `reports_blocks` gains `id` (PK) and `created_at`; one row per (reporter, target, type).
  - A2 Listing room photos are `photos` rows with `is_room_photo = true` (no extra listings column). Non-room photos capped at 6 (3–6 per §3). Room photos/listings only for `have_place`.
  - A3 `swipes.liked_item` is a uuid validated by trigger to be one of the target's photos or prompts. Passes carry no liked_item/comment. Comments ≤ 300 chars.
  - A4 One listing per host (`listings.host_id` unique). `furnished` is boolean. No address column exists.
  - A5 Client-writable columns only: `matches.unmatched_at` (participants, once), `messages.read_at` (recipient). Swipes are immutable. Matches are inserted only by the trigger.
  - Text length caps: name ≤ 50, occupation ≤ 80, bio ≤ 500, prompt question ≤ 150 / answer ≤ 300, message 1–2000, report reason ≤ 500.
- 2026-11-12 — **Matching/feed interpretations (D1–D17), all approved as proposed:**
  - D1 smoking/drinking ∈ `no` (doesn't, not okay with it) / `okay` (doesn't, okay with it) / `yes`. 10 pts each: same = 10, one `okay` = 5, yes vs no = 0.
  - D2 guests ∈ `never/sometimes/often` (same = 4); pets ∈ `has_pets/okay/no_pets` (same = 3); language any shared = 3.
  - D3 food: same = 15; veg+egg = 8; egg+non-veg = 10; veg+non-veg = 3.
  - D4 same sleep = 8; cleanliness within 1 = 7.
  - D5 area = 25 × shared ÷ smaller area count (case-insensitive); a host's listing area counts as one of their areas. **Neighbouring areas deferred** (needs a reference table not in the schema).
  - D6 budget closeness = 15 × (1 − |diff| ÷ larger). Host's budget = rent share.
  - D7 `listings.rent` = monthly amount the incoming roommate pays = rent share.
  - D8 ±30% = |diff| ≤ 30% of the larger budget.
  - D9 Host A + seeker B: A's rent ≤ B's max budget. Two hosts with listings, or a host without a listing: ±30% on max_budget.
  - D10 Dealbreaker fields: food, smoking, drinking, sleep, guests, pets. Marked field must match exactly; checked both directions.
  - D11 Ranking boosts: +10 already liked you, +5 active ≤ 3 days, +3 host with listing for a `need_place` seeker. Displayed match % excludes boosts.
  - D12 25 likes per IST calendar day (resets midnight Asia/Kolkata); counts all likes incl. like-back and "I'm interested"; passes unlimited; server-time only. Error `daily_like_limit_reached` (P0001).
  - D13 Only the viewer's own swipes hide people; someone's pass on you stays private. No pass recycling yet.
  - D14 `get_feed(p_user_id, p_limit = 20 [max 50], p_cursor)`; callers can only load their own feed; cursor = `next_cursor` of the last row ("rank|id").
  - D15 Private `photos` bucket, paths `<user_id>/<file>`, ≤ 3 MB, webp/jpeg/png. Read only if you may view that profile (D16); write only your own folder. `photos.url` stores the storage path (seed rows store https placeholder URLs).
  - D16 Profile visibility (and its preferences/photos/prompts/listing): never if blocked either way; else yourself, active match, someone who liked you, or same city + not paused + your gender ∈ their `show_to_genders`. Reports allowed only on people you can/could see.
  - D17 Seed users: `raw_app_meta_data.seed = true`, phones +91 99999 0xxxx, deterministic ids, placeholder photos; seed refuses to run with > 50 real users; separate dev and prod Supabase projects.

- 2026-11-13 — **Auth + onboarding (§11 step 4) built, per the owner's numbered list:**
  - Order: sign-in → name & DOB (18+) → gender → want_genders → show_to_genders → city & areas → seeking/have place → max budget → move-in date (budget and move-in are **separate screens**) → lifestyle, one question per screen (food, smoking, drinking, sleep, cleanliness, guests, pets, **languages**) → dealbreakers (optional) → occupation → 3–6 photos → 3 prompts → hosts only: listing details → room photos.
  - `work/study` is not asked (owner's list omits it and there is no column); occupation covers it — pending confirmation (§16).
  - Each Continue saves that step to Supabase immediately (profile row is created at name & DOB). Photos are compressed (longest side ≤ 1080px, WebP quality 0.7) and uploaded the moment they're picked. A per-user draft is persisted locally (AsyncStorage) so Back and app restarts never lose answers; server answers win over the draft.
  - Reopening resumes at the first unanswered step. Root navigator uses `Stack.Protected`: signed out → `/phone`; incomplete → `/onboarding`; complete (all steps incl. ≥ 3 non-room photos and 3 prompts; hosts also listing + ≥ 1 room photo) → tabs.
  - Switching a host back to `need_place` deletes their listing and room photos (listings are only for `have_place`).
  - Listing form: area from the city's list, rent (= rent share), deposit, available-from, occupancy chips 1–6, furnished yes/no, optional amenities. Room photos: 1–6 (minimum of 1 chosen by Claude — confirm).
  - SMS provider is configurable without app changes: Supabase Auth "Send SMS" hook → Edge Function `send-sms`, `SMS_PROVIDER=msg91|twilio`. Twilio may instead be set natively in Supabase Auth (no hook).
- 2026-11-13 — **Login changed from phone OTP to Google sign-in (owner decision: SMS setup deferred).**
  - Sign-in screen → "Continue with Google": Supabase OAuth in an in-app browser (`expo-web-browser`), works in Expo Go. Callback `auth/callback`; Supabase must allow redirect URLs `exp://**` (Expo Go) and `roomieroomie://**` (builds). `src/app/+native-intent.tsx` routes the callback to `/`.
  - Phone screens and OTP code removed from the app. The `send-sms` hook (MSG91/Twilio) is kept in `supabase/functions/` for when phone verification returns; phone auth is disabled in the local config.
  - Consequences vs the PDF: no verified phone numbers in v1 for now (§10); 18+ check unchanged (DOB step).
  - Profile tab has a Sign out button.
  - E2E test signs in email/password test users locally (Google can't be automated); same RLS-backed session.

## 16. Open questions (need owner input before the relevant step)
- Logo (app icon and splash still use Expo's default images), and sign-off on the colours/fonts in §15.
- Dark mode: in scope for v1 or not (currently light only).
- Phone verification (PDF §10 "verified phone numbers"): bring back before launch, e.g. as a verification step after Google sign-in? If so: MSG91 (hook, needs DLT template) or Twilio.
- iOS: App Store guideline 4.8 requires **Sign in with Apple** (or an equivalent privacy-focused option) when Google login is offered — needed before App Store submission.
- Launch city (PDF example: Bengaluru).
- N = number of reports before a user is auto-hidden (needed for the review flow; `reports_blocks` already has `created_at`).
- Rate-limit numbers for messages and reports (§9 requires them; likes are done).
- Photo moderation: which moderation API, or manual review at launch.
- Recycle passes after 30 days: on or off (currently off).
- Neighbouring areas for the area score (D5): add a reference table or keep shared-areas only.
- `work/study` (PDF lifestyle list) is not collected — confirm occupation covers it. `bio` has no onboarding step (can be added in Profile edit).
- Confirm room photos minimum (currently 1) and the budget slider range (currently ₹3,000–₹60,000, step ₹500).
- Prompt question bank for the 3 prompts — onboarding currently uses 8 PROVISIONAL questions (`src/features/onboarding/options.ts`).
- City and area lists per city — onboarding currently uses PROVISIONAL lists (12 areas each for Bengaluru, Pune, Mumbai), also languages and amenities.
