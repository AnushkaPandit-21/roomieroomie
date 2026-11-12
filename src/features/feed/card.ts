import type { IconName } from '@/components/ui/Icon';
import { FOOD_OPTIONS } from '@/features/onboarding/options';
import { formatDisplayDate } from '@/utils/date';
import { formatRupees } from '@/utils/format';

import type { CardPhoto, CardProfile, CardPrompt } from './types';

export type CardSection =
  | { type: 'photo'; photo: CardPhoto }
  | { type: 'prompt'; prompt: CardPrompt }
  | { type: 'chips' }
  | { type: 'room' };

// Hinge-style interleaving: photo 1, lifestyle chips, (room panel), prompt 1, photos 2–3, prompt 2,
// photo 4, prompt 3, photos 5–6. Missing items are skipped.
export function buildCardSections(profile: CardProfile): CardSection[] {
  const photos = [...profile.photos].sort((a, b) => a.position - b.position);
  const prompts = [...profile.prompts].sort((a, b) => a.position - b.position);
  const photo = (i: number): CardSection[] => (photos[i] ? [{ type: 'photo', photo: photos[i] }] : []);
  const prompt = (i: number): CardSection[] => (prompts[i] ? [{ type: 'prompt', prompt: prompts[i] }] : []);

  return [
    ...photo(0),
    { type: 'chips' },
    ...(profile.listing ? [{ type: 'room' } as CardSection] : []),
    ...prompt(0),
    ...photo(1),
    ...photo(2),
    ...prompt(1),
    ...photo(3),
    ...prompt(2),
    ...photo(4),
    ...photo(5),
  ];
}

// Lifestyle chip row: budget, area, veg/non-veg, smoking, drinking, move-in date (CLAUDE.md §2).
export type LifestyleChip = { icon: IconName; label: string };

export function lifestyleChips(profile: CardProfile): LifestyleChip[] {
  const p = profile.preferences;
  const chips: LifestyleChip[] = [];
  const budget = profile.listing?.rent ?? profile.maxBudget;
  if (budget != null) chips.push({ icon: 'wallet-outline', label: profile.listing ? `${formatRupees(budget)}/mo rent` : `Up to ${formatRupees(budget)}` });
  if (profile.areas.length) {
    chips.push({ icon: 'location-outline', label: profile.areas.length > 1 ? `${profile.areas[0]} +${profile.areas.length - 1}` : profile.areas[0] });
  }
  if (p?.food) chips.push({ icon: 'restaurant-outline', label: FOOD_OPTIONS.find((o) => o.value === p.food)?.label ?? p.food });
  if (p?.smoking) {
    chips.push({ icon: 'flame-outline', label: p.smoking === 'yes' ? 'Smokes' : p.smoking === 'okay' ? 'OK with smoking' : 'Non-smoker' });
  }
  if (p?.drinking) {
    chips.push({ icon: 'wine-outline', label: p.drinking === 'yes' ? 'Drinks' : p.drinking === 'okay' ? 'OK with drinking' : "Doesn't drink" });
  }
  if (profile.moveInDate) chips.push({ icon: 'calendar-outline', label: `Moves in ${formatDisplayDate(profile.moveInDate)}` });
  return chips;
}
