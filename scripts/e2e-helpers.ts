// Shared helpers for the end-to-end scripts (LOCAL Supabase only).
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { emptyAnswers } from '../src/features/onboarding/answers';
import { loadOnboarding, nextPhotoPosition, saveStep, uploadPhoto } from '../src/features/onboarding/api';
import { stepsFor } from '../src/features/onboarding/steps';
import type { Answers } from '../src/features/onboarding/types';
import { PHOTO_BUCKET } from '../src/services/photos';
import type { Database } from '../src/types/database';
import { addDays, addYears, startOfToday, toISODate } from '../src/utils/date';

export const URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
const SECRET = process.env.SUPABASE_SECRET_KEY;

if (!/127\.0\.0\.1|localhost/.test(URL)) throw new Error('Refusing to run against a non-local Supabase.');
if (!KEY || !SECRET) throw new Error('Set SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY (from `npx supabase status`).');

// 1×1 WebP. Storage validates the declared content type, not pixels.
export const WEBP = Uint8Array.from(atob('UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA='), (c) => c.charCodeAt(0));

export const admin = createClient<Database>(URL, SECRET, { auth: { persistSession: false } });
let passed = 0;
export const passedCount = () => passed;

export const assert = {
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

export function ok(condition: unknown, label: string) {
  assert.ok(condition, label);
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const PASSWORD = 'e2e-Test-password-1';

// Creates the user on first use, then signs in with a fresh client — like reopening the app.
export async function signIn(email: string): Promise<{ client: SupabaseClient<Database>; uid: string }> {
  await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  const client = createClient<Database>(URL, KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error || !data.user) throw error ?? new Error(`Sign-in failed for ${email}`);
  return { client, uid: data.user.id };
}

export async function deleteTestUser(email: string) {
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const user = data.users.find((u) => u.email === email);
  if (!user) return;
  const files = await admin.storage.from(PHOTO_BUCKET).list(user.id);
  if (files.data?.length) await admin.storage.from(PHOTO_BUCKET).remove(files.data.map((f) => `${user.id}/${f.name}`));
  await admin.auth.admin.deleteUser(user.id);
}

export function scriptedAnswers(seeking: 'need_place' | 'have_place'): Answers {
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

// Runs every onboarding step for a signed-in user (uploading 3 photos, and 1 room photo for hosts).
export async function completeProfile(client: SupabaseClient<Database>, uid: string, answers: Answers): Promise<void> {
  let data = await loadOnboarding(client, uid);
  for (const step of stepsFor(answers.seeking_type)) {
    if (step === 'photos' || step === 'room_photos') {
      const isRoom = step === 'room_photos';
      for (let i = 0; i < (isRoom ? 1 : 3); i += 1) {
        await uploadPhoto(client, uid, WEBP, { isRoomPhoto: isRoom, position: nextPhotoPosition(data.photos, isRoom) });
        data = await loadOnboarding(client, uid);
      }
    }
    await saveStep(client, uid, step, answers, data);
    data = await loadOnboarding(client, uid);
  }
}
