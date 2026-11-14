import type { OnboardingData } from '@/features/onboarding/types';

// What of mine someone liked, resolved against my own photos/prompts.
export type MyLikedItem =
  | { kind: 'photo'; url: string }
  | { kind: 'room'; url: string }
  | { kind: 'prompt'; question: string; answer: string }
  | null;

export function resolveMyItem(likedItemId: string | null, mine: OnboardingData | undefined): MyLikedItem {
  if (!likedItemId || !mine) return null;
  const photo = mine.photos.find((p) => p.id === likedItemId);
  if (photo) return { kind: photo.is_room_photo ? 'room' : 'photo', url: photo.url };
  const prompt = mine.prompts.find((p) => p.id === likedItemId);
  if (prompt) return { kind: 'prompt', question: prompt.question, answer: prompt.answer };
  return null;
}

export function likedItemLabel(likedItemId: string | null, mine: OnboardingData | undefined): string {
  const item = resolveMyItem(likedItemId, mine);
  if (item?.kind === 'photo') return 'Liked your photo';
  if (item?.kind === 'room') return 'Interested in your room';
  if (item?.kind === 'prompt') return `Liked your answer: ${item.question}`;
  return 'Liked your profile';
}
