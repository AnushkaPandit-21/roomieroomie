// End-to-end test of the social features against the LOCAL Supabase stack:
// Likes You (like back => match, cross), and later steps' Matches/chat, Rooms and safety flows.
//
//   SUPABASE_PUBLISHABLE_KEY=... SUPABASE_SECRET_KEY=... npx tsx scripts/e2e-social.ts
import { sendLike, sendPass } from '../src/features/feed/api';
import { fetchLikesYouCount, fetchLikesYouPage } from '../src/features/likes/api';
import { likedItemLabel } from '../src/features/likes/labels';
import { loadOnboarding } from '../src/features/onboarding/api';
import type { Answers } from '../src/features/onboarding/types';

import { completeProfile, deleteTestUser, ok, passedCount, scriptedAnswers, signIn } from './e2e-helpers';

// An isolated test city so seed data never appears.
const CITY = 'Socialpur';
const USERS = ['me', 'ana', 'bea', 'cara'] as const;
type Label = (typeof USERS)[number];
const email = (l: Label) => `e2e-social-${l}@roomieroomie.test`;

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

async function main() {
  for (const l of USERS) await deleteTestUser(email(l));
  const users = {} as Record<Label, Awaited<ReturnType<typeof signIn>>>;
  for (const l of USERS) users[l] = await signIn(email(l));
  const { me, ana, bea, cara } = users;

  console.log('Setting up profiles');
  await completeProfile(me.client, me.uid, answers({ name: 'Me' }));
  await completeProfile(ana.client, ana.uid, answers({ name: 'Ana' }));
  await completeProfile(bea.client, bea.uid, answers({ name: 'Bea' }));
  await completeProfile(cara.client, cara.uid, answers({ name: 'Cara' }));
  const mine = await loadOnboarding(me.client, me.uid);

  console.log('\nLikes You');
  ok((await fetchLikesYouPage(me.client)).likes.length === 0, 'starts empty');
  await sendLike(ana.client, ana.uid, me.uid, { likedItemId: mine.photos[0].id, comment: 'Nice place vibes' });
  await sendLike(bea.client, bea.uid, me.uid, { likedItemId: mine.prompts[0].id });
  await sendLike(cara.client, cara.uid, me.uid);

  const page = await fetchLikesYouPage(me.client);
  ok(page.likes.length === 3 && (await fetchLikesYouCount(me.client)) === 3, 'three likes and a matching badge count');
  ok(page.likes[0].profile.id === cara.uid, 'newest like first');
  const fromAna = page.likes.find((l) => l.profile.id === ana.uid)!;
  ok(fromAna.comment === 'Nice place vibes' && likedItemLabel(fromAna.likedItemId, mine) === 'Liked your photo', 'shows the liked photo and comment');
  const fromBea = page.likes.find((l) => l.profile.id === bea.uid)!;
  ok(likedItemLabel(fromBea.likedItemId, mine).startsWith('Liked your answer:'), 'shows the liked prompt');
  ok(fromAna.profile.photos.length === 3 && fromAna.profile.matchScore != null, 'full card with match % for the profile view');

  const paged = await fetchLikesYouPage(me.client, { limit: 2 });
  const rest = await fetchLikesYouPage(me.client, { cursor: paged.nextCursor, limit: 2 });
  ok(paged.likes.length === 2 && rest.likes.length === 1 && rest.nextCursor === null, 'pages through likes');

  const back = await sendLike(me.client, me.uid, ana.uid);
  ok(back.matched && !!back.matchId, 'liking back creates a match (and returns its id)');
  await sendPass(me.client, me.uid, cara.uid);
  const left = await fetchLikesYouPage(me.client);
  ok(left.likes.length === 1 && left.likes[0].profile.id === bea.uid, 'liked-back and crossed people leave Likes You');

  for (const l of USERS) await deleteTestUser(email(l));
  console.log(`\nAll ${passedCount()} checks passed; test users removed.`);
}

main().catch((error) => {
  console.error('\nE2E FAILED:', error);
  throw error;
});
