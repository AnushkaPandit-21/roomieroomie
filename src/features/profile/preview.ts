import type { CardPreferences, CardProfile } from '@/features/feed/types';
import type { OnboardingData } from '@/features/onboarding/types';
import { ageOn } from '@/utils/date';

// My own data as a ProfileCard, so the Profile tab shows exactly what others see.
export function cardFromOnboarding(data: OnboardingData): CardProfile | null {
  const p = data.profile;
  if (!p) return null;
  const pr = data.preferences;
  const preferences: CardPreferences = {
    food: pr?.food ?? null,
    smoking: pr?.smoking ?? null,
    drinking: pr?.drinking ?? null,
    sleep: pr?.sleep ?? null,
    cleanliness: pr?.cleanliness ?? null,
    guests: pr?.guests ?? null,
    pets: pr?.pets ?? null,
    language: pr?.language ?? [],
    religion: pr?.religion ?? null,
  };
  const photos = (room: boolean) =>
    data.photos.filter((x) => x.is_room_photo === room).map((x) => ({ id: x.id, url: x.url, position: x.position }));

  return {
    id: p.id,
    name: p.name,
    age: ageOn(p.dob),
    gender: p.gender,
    city: p.city,
    areas: p.areas,
    maxBudget: p.max_budget,
    householdBudget: p.household_budget,
    moveInDate: p.move_in_date,
    seekingType: p.seeking_type,
    occupation: p.occupation,
    bio: p.bio,
    matchScore: null,
    preferences,
    photos: photos(false),
    prompts: data.prompts.map((q) => ({ id: q.id, question: q.question, answer: q.answer, position: q.position })),
    listing: data.listing
      ? {
          id: data.listing.id,
          area: data.listing.area,
          rent: data.listing.rent,
          deposit: data.listing.deposit,
          available_from: data.listing.available_from,
          occupancy: data.listing.occupancy,
          furnished: data.listing.furnished,
          amenities: data.listing.amenities,
          room_photos: photos(true),
        }
      : null,
  };
}
