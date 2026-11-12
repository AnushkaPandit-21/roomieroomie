import type {
  DealbreakerField,
  FoodPreference,
  Gender,
  GuestsPreference,
  HabitPreference,
  PetsPreference,
  SeekingType,
  SleepSchedule,
} from '@/types/domain';

export type Option<T> = { value: T; label: string; description?: string };

export const GENDER_OPTIONS: Option<Gender>[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'non_binary', label: 'Non-binary' },
];

export const SEEKING_OPTIONS: Option<SeekingType>[] = [
  { value: 'need_place', label: "I'm looking for a place", description: 'I need a room and a roommate' },
  { value: 'have_place', label: 'I have a place', description: 'I have a room or flat to fill' },
];

export const FOOD_OPTIONS: Option<FoodPreference>[] = [
  { value: 'veg', label: 'Vegetarian' },
  { value: 'non-veg', label: 'Non-vegetarian' },
  { value: 'egg', label: 'Eggetarian' },
];

export const SMOKING_OPTIONS: Option<HabitPreference>[] = [
  { value: 'no', label: "I don't smoke", description: 'And I prefer a non-smoker' },
  { value: 'okay', label: "I don't smoke, but I'm okay with it" },
  { value: 'yes', label: 'I smoke' },
];

export const DRINKING_OPTIONS: Option<HabitPreference>[] = [
  { value: 'no', label: "I don't drink", description: 'And I prefer someone who doesn’t' },
  { value: 'okay', label: "I don't drink, but I'm okay with it" },
  { value: 'yes', label: 'I drink' },
];

export const SLEEP_OPTIONS: Option<SleepSchedule>[] = [
  { value: 'early', label: 'Early bird' },
  { value: 'late', label: 'Night owl' },
];

export const CLEANLINESS_OPTIONS: Option<number>[] = [
  { value: 1, label: 'Very relaxed' },
  { value: 2, label: 'Relaxed' },
  { value: 3, label: 'Average' },
  { value: 4, label: 'Tidy' },
  { value: 5, label: 'Very tidy' },
];

export const GUESTS_OPTIONS: Option<GuestsPreference>[] = [
  { value: 'never', label: 'Rarely or never' },
  { value: 'sometimes', label: 'Sometimes' },
  { value: 'often', label: 'Often' },
];

export const PETS_OPTIONS: Option<PetsPreference>[] = [
  { value: 'has_pets', label: 'I have pets' },
  { value: 'okay', label: "No pets, but I'm okay with them" },
  { value: 'no_pets', label: 'No pets, please' },
];

export const DEALBREAKER_LABELS: Record<DealbreakerField, string> = {
  food: 'Food',
  smoking: 'Smoking',
  drinking: 'Drinking',
  sleep: 'Sleep schedule',
  guests: 'Guests',
  pets: 'Pets',
};

// PROVISIONAL (CLAUDE.md §16): cities/areas, languages, prompts, amenities and the budget range are
// placeholders until the owner supplies the final lists. Change them here only.
export const CITIES: { name: string; areas: string[] }[] = [
  {
    name: 'Bengaluru',
    areas: ['Koramangala', 'HSR Layout', 'Indiranagar', 'BTM Layout', 'Bellandur', 'Marathahalli', 'Whitefield',
      'Electronic City', 'JP Nagar', 'Jayanagar', 'Hebbal', 'Malleshwaram'],
  },
  {
    name: 'Pune',
    areas: ['Kothrud', 'Baner', 'Aundh', 'Viman Nagar', 'Hinjewadi', 'Wakad', 'Kharadi', 'Koregaon Park',
      'Hadapsar', 'Magarpatta', 'Shivajinagar', 'Pimple Saudagar'],
  },
  {
    name: 'Mumbai',
    areas: ['Andheri West', 'Andheri East', 'Powai', 'Bandra West', 'Goregaon East', 'Malad West', 'Lower Parel',
      'Dadar', 'Chembur', 'Ghatkopar', 'Santacruz', 'Borivali'],
  },
];

export const LANGUAGES = ['English', 'Hindi', 'Kannada', 'Marathi', 'Tamil', 'Telugu', 'Malayalam', 'Bengali',
  'Gujarati', 'Punjabi', 'Urdu', 'Odia'];

export const PROMPT_QUESTIONS = [
  'My ideal Sunday at home looks like',
  'The house rule I will never break',
  'You will find me in the kitchen making',
  'My roommate green flag is',
  'I am looking for a flatmate who',
  'Weeknights, I am usually',
  'My pet peeve at home is',
  'Best thing about my neighbourhood',
];

export const AMENITIES = ['WiFi', 'AC', 'Washing machine', 'Fridge', 'Geyser', 'Power backup', 'Housekeeping',
  'Parking', 'Gym', 'Lift', 'Meals included', 'Balcony'];

export const BUDGET = { min: 3000, max: 60000, step: 500, initial: 15000 } as const;

export const PHOTO_LIMITS = { min: 3, max: 6 } as const;
export const ROOM_PHOTO_LIMITS = { min: 1, max: 6 } as const;

export const LIMITS = {
  name: 50,
  occupation: 80,
  promptAnswer: 300,
  maxOccupancy: 20,
  moveInWindowDays: 365,
} as const;
