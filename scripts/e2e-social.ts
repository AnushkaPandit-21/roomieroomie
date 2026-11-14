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
import { deleteAccount, setPaused } from '../src/features/profile/api';
import { fetchRoomsPage, sendInterest } from '../src/features/rooms/api';
import { blockUser, reportUser } from '../src/features/safety/api';
import type { Answers, ListingDraft } from '../src/features/onboarding/types';

import { PHOTO_BUCKET } from '../src/services/photos';

import { admin, completeProfile, deleteTestUser, ok, passedCount, scriptedAnswers, signIn, URL } from './e2e-helpers';

// An isolated test city so seed data never appears.
const CITY = 'Socialpur';
const USERS = ['me', 'ana', 'bea', 'cara', 'dee', 'eve'] as const;
type Label = (typeof USERS)[number];
const email = (l: Label) => `e2e-social-${l}@roomieroomie.test`;

function answers(overrides: Partial<Omit<Answers, 'listing'>> & { listing?: Partial<ListingDraft> }): Answers {
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
  const { me, ana, bea, cara, dee, eve } = users;

  console.log('Setting up profiles');
  await completeProfile(me.client, me.uid, answers({ name: 'Me' }));
  await completeProfile(ana.client, ana.uid, answers({ name: 'Ana' }));
  await completeProfile(bea.client, bea.uid, answers({ name: 'Bea' }));
  await completeProfile(cara.client, cara.uid, answers({ name: 'Cara' }));
  await completeProfile(eve.client, eve.uid, answers({ name: 'Eve' }));
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

  console.log('\nRooms');
  await completeProfile(dee.client, dee.uid, answers({ name: 'Dee', seeking_type: 'have_place', listing: { rent: 12000 } }));
  const rooms = await fetchRoomsPage(eve.client);
  const room = rooms.rooms.find((r) => r.id === dee.uid);
  ok(!!room && room.listing?.rent === 12000 && (room.listing?.room_photos.length ?? 0) >= 1, 'a host with a listing shows in Rooms with room photos');
  ok(!('address' in (room?.listing ?? {})), 'no address on a room');
  ok((await fetchRoomsPage(eve.client, { filters: { areas: [], maxBudget: 10000, moveInBy: null } })).rooms.length === 0, 'max rent filter');
  ok((await fetchRoomsPage(eve.client, { filters: { areas: ['Alpha Nagar'], maxBudget: null, moveInBy: null } })).rooms.length === 1, 'area filter');

  const interest = await sendInterest(eve.client, eve.uid, room!, 'Can I visit on Saturday?');
  ok(!interest.matched, '"I\'m interested" is sent as a like');
  ok(!(await fetchRoomsPage(eve.client)).rooms.some((r) => r.id === dee.uid), 'the room leaves my Rooms list');
  const deeMine = await loadOnboarding(dee.client, dee.uid);
  const deeLikes = await fetchLikesYouPage(dee.client);
  const fromEve = deeLikes.likes.find((l) => l.profile.id === eve.uid);
  ok(
    fromEve?.comment === 'Can I visit on Saturday?' && likedItemLabel(fromEve.likedItemId, deeMine) === 'Interested in your room',
    'the host sees "Interested in your room" with the note in Likes You',
  );
  const deeBack = await sendLike(dee.client, dee.uid, eve.uid);
  ok(deeBack.matched, 'the host liking back creates a match');

  console.log('\nPause, push, delete account');
  await setPaused(eve.client, eve.uid, true);
  await sendLike(eve.client, eve.uid, me.uid);
  ok(!(await fetchLikesYouPage(me.client)).likes.some((l) => l.profile.id === eve.uid), 'a paused profile is hidden from Likes You');
  ok((await fetchMatchesPage(eve.client)).matches.length === 1, 'pausing keeps existing matches');
  await setPaused(eve.client, eve.uid, false);
  ok((await fetchLikesYouPage(me.client)).likes.some((l) => l.profile.id === eve.uid), 'unpausing shows them again');

  // The push Edge Function (run `npx supabase functions serve`), in dry-run mode: who gets what.
  const pushSecret = process.env.PUSH_WEBHOOK_SECRET ?? 'local-test-secret';
  const push = async (type: string, record: Record<string, unknown>) => {
    const res = await fetch(`${URL}/functions/v1/push?dry=1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-webhook-secret': pushSecret },
      body: JSON.stringify({ type, record }),
    });
    if (!res.ok) throw new Error(`push function: HTTP ${res.status} ${await res.text()}`);
    return (await res.json()) as { notifications: { id: string; title: string; body: string; data: Record<string, string> }[]; tokens: number };
  };
  await eve.client.from('push_tokens').insert({ profile_id: eve.uid, token: 'ExponentPushToken[e2e-eve]' });
  const msgPush = await push('messages', { match_id: deeBack.matchId, sender_id: dee.uid, body: 'Saturday works!' });
  ok(
    msgPush.notifications.length === 1 && msgPush.notifications[0].id === eve.uid && msgPush.notifications[0].title === 'Dee' &&
      msgPush.notifications[0].body === 'Saturday works!' && msgPush.tokens === 1,
    'a new message notifies the other person, with sender name and text',
  );
  const matchPush = await push('matches', { id: deeBack.matchId, user_a: dee.uid < eve.uid ? dee.uid : eve.uid, user_b: dee.uid < eve.uid ? eve.uid : dee.uid });
  ok(matchPush.notifications.length === 2 && matchPush.notifications.every((n) => n.title === 'It’s a match!'), 'a match notifies both people');
  const likePush = await push('swipes', { action: 'like', swiper_id: eve.uid, target_id: me.uid });
  ok(likePush.notifications.length === 1 && likePush.notifications[0].title === 'Someone liked you', 'a like notifies the person liked, without naming the liker');
  const matchedLike = await push('swipes', { action: 'like', swiper_id: dee.uid, target_id: eve.uid });
  ok(matchedLike.notifications.length === 0, 'a like that made a match sends only the match notification');
  const unauthorized = await fetch(`${URL}/functions/v1/push`, { method: 'POST', headers: { 'x-webhook-secret': 'wrong' }, body: '{}' });
  ok(unauthorized.status === 401, 'the push function rejects calls without the webhook secret');

  // In-app account deletion removes the user, their rows and their photo files.
  const evePhotosBefore = await admin.storage.from(PHOTO_BUCKET).list(eve.uid);
  ok((evePhotosBefore.data?.length ?? 0) >= 3, 'the account to delete has photo files');
  await deleteAccount(eve.client);
  const { data: eveProfile } = await admin.from('profiles').select('id').eq('id', eve.uid).maybeSingle();
  const evePhotosAfter = await admin.storage.from(PHOTO_BUCKET).list(eve.uid);
  const { data: eveAuth } = await admin.auth.admin.getUserById(eve.uid);
  ok(!eveProfile && (evePhotosAfter.data?.length ?? 0) === 0 && !eveAuth.user, 'delete account removes the profile, all photo files and the login');
  ok((await fetchMatchesPage(dee.client)).matches.length === 0, 'their matches and chats disappear for others');

  for (const l of USERS) await deleteTestUser(email(l));
  console.log(`\nAll ${passedCount()} checks passed; test users removed.`);
}

main().catch((error) => {
  console.error('\nE2E FAILED:', error);
  throw error;
});
