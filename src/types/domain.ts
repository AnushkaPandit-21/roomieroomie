// Enum types come straight from the generated database types (CLAUDE.md §6), so they cannot drift.
// Regenerate database.ts after any migration: npx supabase gen types --lang typescript --local --schema public > src/types/database.ts
import type { Database } from './database';

type Enums = Database['public']['Enums'];

export type Gender = Enums['gender'];
export type SeekingType = Enums['seeking_type'];
export type SwipeAction = Enums['swipe_action'];
export type ReportBlockType = Enums['report_type'];
export type FoodPreference = Enums['food_preference'];
export type SleepSchedule = Enums['sleep_schedule'];
export type HabitPreference = Enums['habit_preference'];
export type GuestsPreference = Enums['guests_preference'];
export type PetsPreference = Enums['pets_preference'];
export type DealbreakerField = Enums['dealbreaker_field'];

export type FeedProfile = Database['public']['Functions']['get_feed']['Returns'][number];
