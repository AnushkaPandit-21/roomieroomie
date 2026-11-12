// End-to-end test of Discover against the LOCAL Supabase stack: feed paging, filters, card layout,
// like (on a photo/prompt, with comment), pass, mutual like => match, daily limit, last active.
//
//   SUPABASE_PUBLISHABLE_KEY=... SUPABASE_SECRET_KEY=... npx tsx scripts/e2e-discover.ts
import { buildCardSections, lifestyleChips } from '../src/features/feed/card';
import {
  fetchFeedPage,
  isDailyLimitError,
  sendLike,
  sendPass,
  touchLastActive,
} from '../src/features/feed/api';
import type { CardProfile } from '../src/features/feed/types';
import type { Answers } from '../src/features/onboarding/types';
import { addDays, startOfToday, toISODate } from '../src/utils/date';

import { admin, completeProfile, deleteTestUser, ok, passedCount, scriptedAnswers, signIn } from './e2e-helpers';

// An isolated test city so seed data never appears in these feeds.
const CITY = 'Testpur';
const USERS = ['me', 'host', 'c', 'd', 'e', 'g'] as const;
type Label = (typeof USERS)[number];
const email = (l: Label) => `e2e-discover-${l}@roomieroomie.test`;

function answers(overrides: Partial<Answers>): Answers {
  const base = scriptedAnswers('need_place');
  return {
    ...base,
    city: CITY,
    areas: ['Alpha Nagar'],
    max_budget: 15000,
    dealbreakers: [],
    show_to_genders: ['female'],
    want_genders: ['female'],
    ...overrides,
    listing: { ...base.listing, area: 'Alpha Nagar', rent: 14000, ...(overrides.listing ?? {}) },
  };
}

const ids = (profiles: CardProfile[]) => new Set(profiles.map((p) => p.id));

async function main() {
  for (const l of USERS) await deleteTestUser(email(l));

  const users = {} as Record<Label, Awaited<ReturnType<typeof signIn>>>;
  for (const l of USERS) users[l] = await signIn(email(l));
  const today = startOfToday();

  console.log('Setting up profiles');
  await completeProfile(users.me.client, users.me.uid, answers({ name: 'Me', areas: ['Alpha Nagar', 'Beta Nagar'] }));
  await completeProfile(users.host.client, users.host.uid, answers({ name: 'Host', seeking_type: 'have_place' }));
  await completeProfile(
    users.c.client,
    users.c.uid,
    answers({ name: 'C', areas: ['Beta Nagar'], max_budget: 16000, move_in_date: toISODate(addDays(today, 30)) }),
  );
  await completeProfile(users.d.client, users.d.uid, answers({ name: 'D', gender: 'male', want_genders: ['male'], show_to_genders: ['male'] }));
  await completeProfile(users.e.client, users.e.uid, answers({ name: 'E' }));
  await completeProfile(users.g.client, users.g.uid, answers({ name: 'G' }));
  const { me, host, c, d, e, g } = users;

  console.log('\nFeed');
  const page = await fetchFeedPage(me.client, me.uid);
  const seen = ids(page.profiles);
  ok([host.uid, c.uid, e.uid, g.uid].every((id) => seen.has(id)), 'compatible people appear in the feed');
  ok(!seen.has(d.uid) && !seen.has(me.uid), 'incompatible gender and yourself are excluded');
  ok(page.profiles.every((p) => p.matchScore != null && p.matchScore >= 0 && p.matchScore <= 100), 'every card has a 0–100 match %');

  const hostCard = page.profiles.find((p) => p.id === host.uid)!;
  ok(hostCard.listing?.rent === 14000 && (hostCard.listing?.room_photos.length ?? 0) >= 1, 'host card carries the listing and room photos');
  ok(!('address' in (hostCard.listing ?? {})), 'no address on the card');
  ok(
    buildCardSections(hostCard).map((s) => s.type).join() === 'photo,chips,room,prompt,photo,photo,prompt,prompt',
    'card interleaves photos and prompts in the Hinge order',
  );
  const chips = lifestyleChips(hostCard).map((x) => x.label);
  ok(chips.includes('₹14,000/mo rent') && chips.some((x) => x.startsWith('Moves in')), 'lifestyle chips show budget/rent and move-in');

  console.log('\nPaging');
  const pagedIds: string[] = [];
  let cursor: string | null = null;
  do {
    const p = await fetchFeedPage(me.client, me.uid, { cursor, limit: 1 });
    pagedIds.push(...p.profiles.map((x) => x.id));
    cursor = p.nextCursor;
  } while (cursor);
  ok(pagedIds.length === page.profiles.length && new Set(pagedIds).size === pagedIds.length, 'cursor pages return every card exactly once');

  console.log('\nFilters');
  const byArea = await fetchFeedPage(me.client, me.uid, { filters: { areas: ['Beta Nagar'], maxBudget: null, moveInBy: null } });
  ok([...ids(byArea.profiles)].join() === c.uid, 'area filter');
  const byBudget = await fetchFeedPage(me.client, me.uid, { filters: { areas: [], maxBudget: 14000, moveInBy: null } });
  ok([...ids(byBudget.profiles)].join() === host.uid, 'budget filter (host judged by rent share)');
  const byDate = await fetchFeedPage(me.client, me.uid, {
    filters: { areas: [], maxBudget: null, moveInBy: toISODate(addDays(today, 20)) },
  });
  ok(!ids(byDate.profiles).has(c.uid) && ids(byDate.profiles).has(host.uid), 'move-in filter');

  console.log('\nLikes, passes and matches');
  const myCard = (await fetchFeedPage(e.client, e.uid)).profiles.find((p) => p.id === me.uid)!;
  const first = await sendLike(e.client, e.uid, me.uid, { likedItemId: myCard.photos[0].id, comment: 'Love this!' });
  ok(!first.matched, 'a one-sided like is not a match');

  const eCard = page.profiles.find((p) => p.id === e.uid)!;
  const back = await sendLike(me.client, me.uid, e.uid, { likedItemId: eCard.prompts[0].id, comment: ' Same! ' });
  ok(back.matched, 'liking someone who already liked you is a match');

  const liked = await me.client.from('swipes').select('liked_item, comment').eq('target_id', e.uid).single();
  ok(liked.data?.liked_item === eCard.prompts[0].id && liked.data?.comment === 'Same!', 'liked prompt and trimmed comment are stored');

  const plain = await sendLike(me.client, me.uid, host.uid);
  ok(!plain.matched, 'a plain like (no item, no comment) works');
  await sendPass(me.client, me.uid, c.uid);
  const after = ids((await fetchFeedPage(me.client, me.uid)).profiles);
  ok(!after.has(e.uid) && !after.has(host.uid) && !after.has(c.uid) && after.has(g.uid), 'liked, matched and crossed people leave the feed');

  console.log('\nDaily like limit');
  const { data: seeds } = await admin.from('profiles').select('id').neq('city', CITY).limit(23);
  const fill = await admin.from('swipes').insert(
    (seeds ?? []).map((s) => ({ swiper_id: me.uid, target_id: s.id, action: 'like' as const })),
  );
  if (fill.error) throw fill.error;
  let limitError: unknown = null;
  try {
    await sendLike(me.client, me.uid, g.uid);
  } catch (error) {
    limitError = error;
  }
  ok(isDailyLimitError(limitError), 'the 26th like today is refused with the daily-limit error');
  await sendPass(me.client, me.uid, g.uid);
  ok(true, 'crossing still works after the limit');

  console.log('\nLast active');
  await admin.from('profiles').update({ last_active_at: new Date(Date.now() - 10 * 864e5).toISOString() }).eq('id', me.uid);
  await touchLastActive(me.client);
  const { data: fresh } = await admin.from('profiles').select('last_active_at').eq('id', me.uid).single();
  ok(Date.now() - new Date(fresh!.last_active_at).getTime() < 60_000, 'touch_last_active marks the user active now');

  for (const l of USERS) await deleteTestUser(email(l));
  console.log(`\nAll ${passedCount()} checks passed; test users removed.`);
}

main().catch((error) => {
  console.error('\nE2E FAILED:', error);
  throw error;
});
