// Supabase reads/writes for onboarding. Takes the client as a parameter and imports nothing from
// React Native, so the same code runs in the app and in scripts/e2e-onboarding.ts.
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database';

import type { StepId } from './steps';
import type { Answers, OnboardingData, PhotoRow } from './types';

type Client = SupabaseClient<Database>;

export const PHOTO_BUCKET = 'photos';

function check<T>(result: { data: T; error: unknown }): T {
  if (result.error) throw result.error;
  return result.data;
}

export async function sendOtp(client: Client, phone: string): Promise<void> {
  const { error } = await client.auth.signInWithOtp({ phone });
  if (error) throw error;
}

export async function verifyOtp(client: Client, phone: string, token: string): Promise<void> {
  const { error } = await client.auth.verifyOtp({ phone, token, type: 'sms' });
  if (error) throw error;
}

export async function loadOnboarding(client: Client, userId: string): Promise<OnboardingData> {
  const [profile, preferences, photos, prompts, listing] = await Promise.all([
    client.from('profiles').select('*').eq('id', userId).maybeSingle(),
    client.from('preferences').select('*').eq('profile_id', userId).maybeSingle(),
    client.from('photos').select('*').eq('profile_id', userId).order('position'),
    client.from('prompts').select('*').eq('profile_id', userId).order('position'),
    client.from('listings').select('*').eq('host_id', userId).maybeSingle(),
  ]);

  return {
    profile: check(profile),
    preferences: check(preferences),
    photos: check(photos) ?? [],
    prompts: check(prompts) ?? [],
    listing: check(listing),
  };
}

async function updateProfile(
  client: Client,
  userId: string,
  values: Database['public']['Tables']['profiles']['Update'],
): Promise<void> {
  check(await client.from('profiles').update(values).eq('id', userId));
}

async function upsertPreferences(
  client: Client,
  userId: string,
  values: Omit<Database['public']['Tables']['preferences']['Insert'], 'profile_id'>,
): Promise<void> {
  check(await client.from('preferences').upsert({ profile_id: userId, ...values }, { onConflict: 'profile_id' }));
}

// Saves the answers for one step to the right table(s).
export async function saveStep(
  client: Client,
  userId: string,
  step: StepId,
  a: Answers,
  current: OnboardingData,
): Promise<void> {
  switch (step) {
    case 'name_dob':
      // First write creates the profile row (name + dob are required columns).
      check(
        await client
          .from('profiles')
          .upsert({ id: userId, name: a.name.trim(), dob: a.dob! }, { onConflict: 'id' }),
      );
      return;
    case 'gender':
      return updateProfile(client, userId, { gender: a.gender });
    case 'want_genders':
      return updateProfile(client, userId, { want_genders: a.want_genders });
    case 'show_to_genders':
      return updateProfile(client, userId, { show_to_genders: a.show_to_genders });
    case 'city_areas':
      return updateProfile(client, userId, { city: a.city, areas: a.areas });
    case 'seeking_type':
      await updateProfile(client, userId, { seeking_type: a.seeking_type });
      // Listings and room photos exist only for have_place users.
      if (a.seeking_type === 'need_place') await removeListing(client, userId, current);
      return;
    case 'max_budget':
      return updateProfile(client, userId, { max_budget: a.max_budget });
    case 'move_in_date':
      return updateProfile(client, userId, { move_in_date: a.move_in_date });
    case 'food':
      return upsertPreferences(client, userId, { food: a.food });
    case 'smoking':
      return upsertPreferences(client, userId, { smoking: a.smoking });
    case 'drinking':
      return upsertPreferences(client, userId, { drinking: a.drinking });
    case 'sleep':
      return upsertPreferences(client, userId, { sleep: a.sleep });
    case 'cleanliness':
      return upsertPreferences(client, userId, { cleanliness: a.cleanliness });
    case 'guests':
      return upsertPreferences(client, userId, { guests: a.guests });
    case 'pets':
      return upsertPreferences(client, userId, { pets: a.pets });
    case 'languages':
      return upsertPreferences(client, userId, { language: a.language });
    case 'dealbreakers':
      return upsertPreferences(client, userId, { dealbreakers: a.dealbreakers });
    case 'occupation':
      return updateProfile(client, userId, { occupation: a.occupation.trim() });
    case 'photos':
    case 'room_photos':
      // Photos are saved as they are added; nothing else to write.
      return;
    case 'prompts':
      return savePrompts(client, userId, a, current);
    case 'listing':
      check(
        await client.from('listings').upsert(
          {
            host_id: userId,
            area: a.listing.area!,
            rent: a.listing.rent!,
            deposit: a.listing.deposit,
            available_from: a.listing.available_from!,
            occupancy: a.listing.occupancy,
            furnished: a.listing.furnished,
            amenities: a.listing.amenities,
          },
          { onConflict: 'host_id' },
        ),
      );
      return;
  }
}

// prompts has a deferrable unique (profile_id, position), which ON CONFLICT can't target,
// so existing rows are updated by id and missing positions inserted.
async function savePrompts(client: Client, userId: string, a: Answers, current: OnboardingData): Promise<void> {
  for (let i = 0; i < 3; i += 1) {
    const position = i + 1;
    const values = { question: a.prompts[i].question, answer: a.prompts[i].answer.trim() };
    const existing = current.prompts.find((p) => p.position === position);
    if (existing) {
      check(await client.from('prompts').update(values).eq('id', existing.id));
    } else {
      check(await client.from('prompts').insert({ profile_id: userId, position, ...values }));
    }
  }
}

async function removeListing(client: Client, userId: string, current: OnboardingData): Promise<void> {
  const roomPhotos = current.photos.filter((p) => p.is_room_photo);
  for (const photo of roomPhotos) await deletePhoto(client, photo);
  if (current.listing) check(await client.from('listings').delete().eq('host_id', userId));
}

function randomName(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}.webp`;
}

// Uploads already-compressed WebP bytes to <userId>/<file>.webp and records the photo row.
export async function uploadPhoto(
  client: Client,
  userId: string,
  bytes: Uint8Array | ArrayBuffer,
  options: { isRoomPhoto: boolean; position: number },
): Promise<PhotoRow> {
  const path = `${userId}/${randomName()}`;
  check(
    await client.storage.from(PHOTO_BUCKET).upload(path, bytes, { contentType: 'image/webp', upsert: false }),
  );

  const inserted = await client
    .from('photos')
    .insert({ profile_id: userId, url: path, position: options.position, is_room_photo: options.isRoomPhoto })
    .select()
    .single();

  if (inserted.error) {
    // Don't leave an orphaned file if the row can't be created (e.g. the 6-photo cap).
    await client.storage.from(PHOTO_BUCKET).remove([path]);
    throw inserted.error;
  }
  return inserted.data;
}

export async function deletePhoto(client: Client, photo: PhotoRow): Promise<void> {
  check(await client.from('photos').delete().eq('id', photo.id));
  if (!/^https?:\/\//.test(photo.url)) {
    await client.storage.from(PHOTO_BUCKET).remove([photo.url]);
  }
}

export function nextPhotoPosition(photos: PhotoRow[], isRoomPhoto: boolean): number {
  const used = photos.filter((p) => p.is_room_photo === isRoomPhoto).map((p) => p.position);
  return used.length ? Math.max(...used) + 1 : 0;
}

// Signed URLs for private storage paths; full http(s) URLs (seed data) pass through unchanged.
export async function signPhotoUrls(client: Client, paths: string[]): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  const storagePaths = paths.filter((p) => !/^https?:\/\//.test(p));
  paths.filter((p) => /^https?:\/\//.test(p)).forEach((p) => (result[p] = p));
  if (!storagePaths.length) return result;

  const signed = check(await client.storage.from(PHOTO_BUCKET).createSignedUrls(storagePaths, 60 * 60));
  signed?.forEach((s) => {
    if (s.path && s.signedUrl) result[s.path] = s.signedUrl;
  });
  return result;
}
