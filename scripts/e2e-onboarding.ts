// End-to-end test of the onboarding data flow against the LOCAL Supabase stack.
// Uses the exact functions the app uses (src/features/onboarding/*) with a real phone-OTP session and RLS.
//
//   npx supabase start
//   SUPABASE_PUBLISHABLE_KEY=... SUPABASE_SECRET_KEY=... npx tsx scripts/e2e-onboarding.ts
//
// Test numbers +91 99999 1000x use the fixed local OTP 123456 (supabase/config.toml).
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { answersFromData, emptyAnswers, mergeDraft } from '../src/features/onboarding/answers';
import {
  deletePhoto,
  loadOnboarding,
  nextPhotoPosition,
  PHOTO_BUCKET,
  saveStep,
  sendOtp,
  signPhotoUrls,
  uploadPhoto,
  verifyOtp,
} from '../src/features/onboarding/api';
import { getOnboardingStatus, isStepDone, stepsFor, type StepId } from '../src/features/onboarding/steps';
import type { Answers } from '../src/features/onboarding/types';
import { normalizeIndianPhone, validateDob, validateStep } from '../src/features/onboarding/validation';
import type { Database } from '../src/types/database';
import { addDays, addYears, startOfToday, toISODate } from '../src/utils/date';

const URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
const SECRET = process.env.SUPABASE_SECRET_KEY;

if (!/127\.0\.0\.1|localhost/.test(URL)) throw new Error('Refusing to run against a non-local Supabase.');
if (!KEY || !SECRET) throw new Error('Set SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY (from `npx supabase status`).');

// 1×1 WebP. Storage validates the declared content type, not pixels.
const WEBP = Uint8Array.from(atob('UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA='), (c) => c.charCodeAt(0));

const admin = createClient<Database>(URL, SECRET, { auth: { persistSession: false } });
let passed = 0;

const assert = {
  ok(condition: unknown, label: string) {
    if (!condition) throw new Error(`Assertion failed: ${label}`);
  },
  equal(actual: unknown, expected: unknown, label: string) {
    if (actual !== expected) throw new Error(`Assertion failed: ${label} (got ${String(actual)})`);
  },
  async rejects(promise: Promise<unknown>, label: string) {
    try {
      await promise;
    } catch {
      return;
    }
    throw new Error(`Expected rejection: ${label}`);
  },
};

function ok(condition: unknown, label: string) {
  assert.ok(condition, label);
  passed += 1;
  console.log(`  ✓ ${label}`);
}

async function signIn(phone: string): Promise<{ client: SupabaseClient<Database>; uid: string }> {
  const client = createClient<Database>(URL, KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  for (;;) {
    try {
      await sendOtp(client, phone);
      break;
    } catch (error) {
      // Auth enforces a minimum gap between codes to the same number; wait it out like a user would.
      const wait = /after (\d+) seconds/.exec((error as Error).message)?.[1];
      if (!wait) throw error;
      await new Promise((r) => setTimeout(r, (Number(wait) + 1) * 1000));
    }
  }
  await verifyOtp(client, phone, '123456');
  const { data } = await client.auth.getUser();
  if (!data.user) throw new Error(`Sign-in failed for ${phone}`);
  return { client, uid: data.user.id };
}

async function deleteTestUser(phone: string) {
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const user = data.users.find((u) => u.phone === phone.replace('+', ''));
  if (!user) return;
  const files = await admin.storage.from(PHOTO_BUCKET).list(user.id);
  if (files.data?.length) await admin.storage.from(PHOTO_BUCKET).remove(files.data.map((f) => `${user.id}/${f.name}`));
  await admin.auth.admin.deleteUser(user.id);
}

function scriptedAnswers(seeking: 'need_place' | 'have_place'): Answers {
  const today = startOfToday();
  return {
    ...emptyAnswers(),
    name: 'Test Meera',
    dob: toISODate(addYears(today, -24)),
    gender: 'female',
    want_genders: ['female', 'non_binary'],
    show_to_genders: ['female'],
    city: 'Bengaluru',
    areas: ['Koramangala', 'HSR Layout'],
    seeking_type: seeking,
    max_budget: 18000,
    move_in_date: toISODate(addDays(today, 14)),
    food: 'veg',
    smoking: 'no',
    drinking: 'okay',
    sleep: 'early',
    cleanliness: 4,
    guests: 'sometimes',
    pets: 'okay',
    language: ['English', 'Hindi', 'Kannada'],
    dealbreakers: ['smoking'],
    occupation: 'Product Designer',
    prompts: [
      { question: 'My ideal Sunday at home looks like', answer: 'Chai and a long breakfast.' },
      { question: 'The house rule I will never break', answer: 'Dishes done the same day.' },
      { question: 'My roommate green flag is', answer: 'Replacing the milk.' },
    ],
    listing: {
      area: 'Koramangala',
      rent: 16000,
      deposit: 32000,
      available_from: toISODate(addDays(today, 10)),
      occupancy: 2,
      furnished: true,
      amenities: ['WiFi', 'Washing machine'],
    },
  };
}

async function completeFlow(phone: string, seeking: 'need_place' | 'have_place') {
  console.log(`\n${seeking} flow (${phone})`);
  await deleteTestUser(phone);
  const { client, uid } = await signIn(phone);
  ok(true, 'phone OTP sign-in works');

  let data = await loadOnboarding(client, uid);
  let status = getOnboardingStatus(data);
  ok(!status.complete && status.resumeStep === 'name_dob', 'new user starts at name & date of birth');

  const answers = scriptedAnswers(seeking);

  // Under-18 is rejected by the client validator and by the database.
  const minor = { ...answers, dob: toISODate(addYears(startOfToday(), -17)) };
  ok(validateStep('name_dob', minor, data) !== null, 'client rejects under-18');
  const dbMinor = await client.from('profiles').insert({ id: uid, name: 'Minor', dob: minor.dob! });
  ok(dbMinor.error?.code === '23514', 'database rejects under-18');

  for (const step of stepsFor(seeking)) {
    if (step === 'photos' || step === 'room_photos') {
      const isRoom = step === 'room_photos';
      const needed = isRoom ? 1 : 3;
      ok(validateStep(step, answers, data) !== null, `${step}: cannot continue with 0 photos`);
      for (let i = 0; i < needed; i += 1) {
        await uploadPhoto(client, uid, WEBP, { isRoomPhoto: isRoom, position: nextPhotoPosition(data.photos, isRoom) });
        data = await loadOnboarding(client, uid);
      }
    }
    assert.equal(validateStep(step, answers, data), null, `${step} validates`);
    await saveStep(client, uid, step, answers, data);
    data = await loadOnboarding(client, uid);
    status = getOnboardingStatus(data);
    assert.ok(isStepDone(step, data), `${step} saved`);
    if (step === 'prompts' && seeking === 'need_place') break;
    assert.ok(!status.complete || step === stepsFor(seeking).at(-1), `${step}: still incomplete`);
  }
  ok(true, `all ${stepsFor(seeking).length} steps validate and save`);
  ok(status.complete, 'profile is complete after the last step');

  // Saved to the right tables and columns.
  ok(data.profile?.areas.join() === 'Koramangala,HSR Layout' && data.profile?.max_budget === 18000, 'profile columns saved');
  ok(data.preferences?.language.length === 3 && data.preferences?.dealbreakers.join() === 'smoking', 'preferences saved');
  ok(data.photos.filter((p) => !p.is_room_photo).length === 3, '3 profile photos stored');
  ok(data.photos.every((p) => p.url.startsWith(`${uid}/`) && p.url.endsWith('.webp')), 'photos stored as <uid>/<file>.webp');
  ok(data.prompts.length === 3, '3 prompts saved');
  ok(seeking === 'have_place' ? data.listing?.rent === 16000 : data.listing === null, 'listing only for hosts');

  const signed = await signPhotoUrls(client, data.photos.map((p) => p.url));
  ok(Object.keys(signed).length === data.photos.length, 'own photos get signed URLs');

  // Reopen the app: fresh session, same phone — everything restores.
  const reopened = await signIn(phone);
  ok(reopened.uid === uid, 'same account after re-login');
  const restored = await loadOnboarding(reopened.client, uid);
  ok(getOnboardingStatus(restored).complete, 'completion survives reopening');
  const restoredAnswers = answersFromData(restored);
  ok(
    restoredAnswers.name === answers.name &&
      restoredAnswers.prompts[2].answer === answers.prompts[2].answer &&
      restoredAnswers.show_to_genders.join() === 'female',
    'answers restore from the database',
  );

  const feed = await reopened.client.rpc('get_feed', { p_user_id: uid });
  ok(!feed.error, `get_feed works for the new user (${feed.data?.length ?? 0} profiles)`);

  return { client, uid, data };
}

async function main() {
  console.log('Validators');
  ok(normalizeIndianPhone('98765 43210') === '+919876543210', 'normalises a 10-digit number');
  ok(normalizeIndianPhone('+91 98765-43210') === '+919876543210', 'accepts +91 prefix');
  ok(normalizeIndianPhone('12345 67890') === null, 'rejects numbers not starting 6–9');
  ok(validateDob(toISODate(addYears(startOfToday(), -18))) === null, 'exactly 18 today is allowed');
  ok(validateDob(toISODate(addDays(addYears(startOfToday(), -18), 1))) !== null, '18 tomorrow is rejected');

  await completeFlow('+919999910001', 'need_place');
  const host = await completeFlow('+919999910002', 'have_place');

  console.log('\nSwitching a host to seeker');
  const roomPhoto = host.data.photos.find((p) => p.is_room_photo)!;
  await saveStep(host.client, host.uid, 'seeking_type', { ...answersFromData(host.data), seeking_type: 'need_place' }, host.data);
  const switched = await loadOnboarding(host.client, host.uid);
  ok(switched.listing === null && !switched.photos.some((p) => p.is_room_photo), 'listing and room photos removed');
  const objects = await admin.storage.from(PHOTO_BUCKET).list(host.uid);
  ok(!objects.data?.some((o) => roomPhoto.url.endsWith(o.name)), 'room photo file deleted from storage');
  ok(getOnboardingStatus(switched).complete, 'still complete as a seeker');

  console.log('\nPartial onboarding + restore');
  const phone = '+919999910003';
  await deleteTestUser(phone);
  const partial = await signIn(phone);
  const a = scriptedAnswers('need_place');
  let d = await loadOnboarding(partial.client, partial.uid);
  for (const step of ['name_dob', 'gender', 'want_genders'] as StepId[]) {
    await saveStep(partial.client, partial.uid, step, a, d);
    d = await loadOnboarding(partial.client, partial.uid);
  }
  const reopen = await signIn(phone);
  const status = getOnboardingStatus(await loadOnboarding(reopen.client, reopen.uid));
  ok(!status.complete && status.resumeStep === 'show_to_genders', 'reopening resumes at the first unanswered step');

  const localDraft = { ...emptyAnswers(), name: 'Old local name', occupation: 'Typed but not saved' };
  const merged = mergeDraft(answersFromData(d), localDraft);
  ok(merged.name === 'Test Meera' && merged.occupation === 'Typed but not saved', 'server answers win; unsaved local draft is kept');

  console.log('\nPhoto rules');
  for (let i = 0; i < 6; i += 1) {
    await uploadPhoto(partial.client, partial.uid, WEBP, { isRoomPhoto: false, position: i });
  }
  await assert.rejects(
    uploadPhoto(partial.client, partial.uid, WEBP, { isRoomPhoto: false, position: 6 }),
    'seventh photo rejected',
  );
  d = await loadOnboarding(partial.client, partial.uid);
  ok(d.photos.length === 6, 'a 7th profile photo is rejected (max 6) and its file is not orphaned');
  const files = await admin.storage.from(PHOTO_BUCKET).list(partial.uid);
  ok(files.data?.length === 6, 'storage holds exactly the 6 photo files');
  await deletePhoto(partial.client, d.photos[0]);
  d = await loadOnboarding(partial.client, partial.uid);
  ok(d.photos.length === 5, 'deleting a photo removes the row');
  await assert.rejects(
    uploadPhoto(partial.client, partial.uid, WEBP, { isRoomPhoto: true, position: 0 }),
    'room photo rejected for seeker',
  );
  ok(true, 'seekers cannot add room photos');

  const other = await signIn('+919999910004');
  const sneaky = await other.client.storage.from(PHOTO_BUCKET).upload(`${partial.uid}/evil.webp`, WEBP, { contentType: 'image/webp' });
  ok(sneaky.error, 'cannot upload into another user’s photo folder');

  for (const p of ['+919999910001', '+919999910002', '+919999910003', '+919999910004']) await deleteTestUser(p);
  console.log(`\nAll ${passed} checks passed; test users removed.`);
}

main().catch((error) => {
  console.error('\nE2E FAILED:', error);
  process.exit(1);
});
