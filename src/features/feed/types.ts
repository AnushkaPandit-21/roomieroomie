import type {
  FoodPreference,
  Gender,
  GuestsPreference,
  HabitPreference,
  PetsPreference,
  SeekingType,
  SleepSchedule,
} from '@/types/domain';

export type CardPhoto = { id: string; url: string; position: number };
export type CardPrompt = { id: string; question: string; answer: string; position: number };

export type CardListing = {
  id: string;
  area: string;
  rent: number;
  deposit: number | null;
  available_from: string;
  occupancy: number | null;
  furnished: boolean | null;
  amenities: string[];
  room_photos: CardPhoto[];
};

export type CardPreferences = {
  food: FoodPreference | null;
  smoking: HabitPreference | null;
  drinking: HabitPreference | null;
  sleep: SleepSchedule | null;
  cleanliness: number | null;
  guests: GuestsPreference | null;
  pets: PetsPreference | null;
  language: string[];
};

// One profile as shown on a ProfileCard (Discover now; Likes You / Matches later).
export type CardProfile = {
  id: string;
  name: string;
  age: number;
  gender: Gender | null;
  city: string | null;
  areas: string[];
  maxBudget: number | null;
  moveInDate: string | null;
  seekingType: SeekingType | null;
  occupation: string | null;
  bio: string | null;
  matchScore: number | null;
  preferences: CardPreferences;
  photos: CardPhoto[];
  prompts: CardPrompt[];
  listing: CardListing | null;
};

export type FeedFilters = {
  areas: string[];
  maxBudget: number | null;
  moveInBy: string | null;
};

export const NO_FILTERS: FeedFilters = { areas: [], maxBudget: null, moveInBy: null };

export function hasActiveFilters(f: FeedFilters): boolean {
  return f.areas.length > 0 || f.maxBudget != null || f.moveInBy != null;
}

export type LikedItem = { kind: 'photo'; photo: CardPhoto } | { kind: 'prompt'; prompt: CardPrompt };
