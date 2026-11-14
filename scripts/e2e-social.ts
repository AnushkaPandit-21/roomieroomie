// End-to-end test of the social features against the LOCAL Supabase stack:
// Likes You (like back => match, cross), and later steps' Matches/chat, Rooms and safety flows.
//
//   SUPABASE_PUBLISHABLE_KEY=... SUPABASE_SECRET_KEY=... npx tsx scripts/e2e-social.ts
import {
  fetchMatchesPage,
  fetchMessages,
  fetchProfile,
  fetchUnreadCount,
  markMatchRead,
  sendMessage,
  unmatch,
} from '../src/features/chat/api';
import type { ChatMessage } from '../src/features/chat/types';
import { sendLike, sendPass } from '../src/features/feed/api';
import { fetchLikesYouCount, fetchLikesYouPage } from '../src/features/likes/api';
import { likedItemLabel } from '../src/features/likes/labels';
import { loadOnboarding } from '../src/features/onboarding/api';
import { blockUser, reportUser } from '../src/features/safety/api';
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

  console.log('\nMatches + chat');
  const matchId = back.matchId!;
  let matches = (await fetchMatchesPage(me.client)).matches;
  ok(matches.length === 1 && matches[0].profileId === ana.uid && matches[0].lastMessage === null, 'a new match appears with no messages');

  // Ana listens on the match channel (as the chat screen does) while I send.
  const received = new Promise<ChatMessage>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('no realtime message within 20s')), 20000);
    const channel = ana.client
      .channel(`match:${matchId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `match_id=eq.${matchId}` }, (p) => {
        clearTimeout(timer);
        ana.client.removeChannel(channel);
        resolve(p.new as ChatMessage);
      })
      .subscribe((status) => {
        // The server starts forwarding changes shortly after SUBSCRIBED; give it a moment.
        if (status === 'SUBSCRIBED') {
          setTimeout(() => sendMessage(me.client, matchId, me.uid, '  Hi Ana! Still looking?  ').catch(reject), 3000);
        }
      });
  });
  const live = await received;
  ok(live.body === 'Hi Ana! Still looking?' && live.sender_id === me.uid, 'the other person receives the message live (Realtime)');

  await sendMessage(ana.client, matchId, ana.uid, 'Yes! When can you visit?');
  matches = (await fetchMatchesPage(me.client)).matches;
  ok(
    matches[0].lastMessage === 'Yes! When can you visit?' && matches[0].yourTurn && matches[0].unreadCount === 1,
    'list shows last message, unread count and "your turn"',
  );
  ok((await fetchUnreadCount(me.client)) === 1, 'unread badge counts the conversation');
  ok((await markMatchRead(me.client, matchId)) === 1 && (await fetchUnreadCount(me.client)) === 0, 'opening the chat marks it read');
  const history = await fetchMessages(ana.client, matchId);
  ok(history.messages.length === 2 && history.messages[0].sender_id === ana.uid, 'history is newest first');
  ok(!!history.messages[0].read_at, 'the sender sees a read receipt');

  ok((await fetchMessages(cara.client, matchId)).messages.length === 0, 'people outside the match cannot read it');
  let refused = false;
  try {
    await sendMessage(cara.client, matchId, cara.uid, 'let me in');
  } catch {
    refused = true;
  }
  ok(refused, 'people outside the match cannot write to it');
  ok((await fetchProfile(me.client, ana.uid))?.name === 'Ana', "a match's profile opens from the chat");

  console.log('\nUnmatch, report, block');
  await unmatch(me.client, matchId);
  ok((await fetchMatchesPage(ana.client)).matches.length === 0, 'unmatch hides the chat for both people');

  await reportUser(me.client, me.uid, bea.uid, 'Fake profile or catfishing');
  ok((await fetchLikesYouPage(me.client)).likes.length === 0, 'reporting someone removes them from Likes You');
  await reportUser(me.client, me.uid, bea.uid, 'again');
  ok(true, 'reporting twice is harmless');
  await blockUser(me.client, me.uid, cara.uid);
  ok((await fetchProfile(cara.client, me.uid)) === null, 'a blocked person can no longer open your profile');

  for (const l of USERS) await deleteTestUser(email(l));
  console.log(`\nAll ${passedCount()} checks passed; test users removed.`);
}

main().catch((error) => {
  console.error('\nE2E FAILED:', error);
  throw error;
});
