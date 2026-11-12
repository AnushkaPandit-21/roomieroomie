import { addDays, ageOn, isValidISODate, parseISODate, startOfToday } from '@/utils/date';

import { BUDGET, CITIES, LIMITS, PHOTO_LIMITS, ROOM_PHOTO_LIMITS } from './options';
import { countPhotos, type StepId } from './steps';
import type { Answers, OnboardingData } from './types';

export function validateDob(dob: string | null): string | null {
  if (!isValidISODate(dob)) return 'Enter your date of birth.';
  if (parseISODate(dob) > startOfToday()) return 'Date of birth can’t be in the future.';
  const age = ageOn(dob);
  if (age < 18) return 'You must be 18 or older to use RoomieRoomie.';
  if (age > 100) return 'Please check your date of birth.';
  return null;
}

// Returns a user-facing error, or null if the step's answers can be saved.
export function validateStep(step: StepId, a: Answers, data: OnboardingData): string | null {
  switch (step) {
    case 'name_dob': {
      const name = a.name.trim();
      if (!name) return 'Enter your name.';
      if (name.length > LIMITS.name) return `Name must be ${LIMITS.name} characters or fewer.`;
      return validateDob(a.dob);
    }
    case 'gender':
      return a.gender ? null : 'Choose the option that best describes you.';
    case 'want_genders':
      return a.want_genders.length ? null : 'Choose at least one.';
    case 'show_to_genders':
      return a.show_to_genders.length ? null : 'Choose at least one.';
    case 'city_areas': {
      const city = CITIES.find((c) => c.name === a.city);
      if (!city) return 'Choose your city.';
      if (!a.areas.length) return 'Choose at least one area.';
      if (a.areas.some((area) => !city.areas.includes(area))) return 'Choose areas in your city.';
      return null;
    }
    case 'seeking_type':
      return a.seeking_type ? null : 'Choose one.';
    case 'max_budget':
      return a.max_budget != null && a.max_budget >= BUDGET.min && a.max_budget <= BUDGET.max
        ? null
        : 'Set your maximum budget.';
    case 'move_in_date': {
      if (!isValidISODate(a.move_in_date)) return 'Choose your move-in date.';
      const date = parseISODate(a.move_in_date);
      if (date < startOfToday()) return 'Move-in date can’t be in the past.';
      if (date > addDays(startOfToday(), LIMITS.moveInWindowDays)) return 'Choose a date within the next year.';
      return null;
    }
    case 'food':
    case 'smoking':
    case 'drinking':
    case 'sleep':
    case 'guests':
    case 'pets':
      return a[step] ? null : 'Choose one.';
    case 'cleanliness':
      return a.cleanliness != null ? null : 'Choose one.';
    case 'languages':
      return a.language.length ? null : 'Choose at least one language.';
    case 'dealbreakers':
      return null;
    case 'occupation': {
      const value = a.occupation.trim();
      if (!value) return 'Tell us what you do.';
      if (value.length > LIMITS.occupation) return `Keep it to ${LIMITS.occupation} characters or fewer.`;
      return null;
    }
    case 'photos': {
      const n = countPhotos(data, false);
      return n >= PHOTO_LIMITS.min ? null : `Add at least ${PHOTO_LIMITS.min} photos (${n} so far).`;
    }
    case 'prompts': {
      if (a.prompts.some((p) => !p.question)) return 'Choose 3 prompts.';
      if (new Set(a.prompts.map((p) => p.question)).size !== 3) return 'Choose 3 different prompts.';
      if (a.prompts.some((p) => !p.answer.trim())) return 'Answer all 3 prompts.';
      if (a.prompts.some((p) => p.answer.trim().length > LIMITS.promptAnswer)) {
        return `Keep each answer to ${LIMITS.promptAnswer} characters or fewer.`;
      }
      return null;
    }
    case 'listing': {
      const l = a.listing;
      const city = CITIES.find((c) => c.name === a.city);
      if (!l.area || (city && !city.areas.includes(l.area))) return 'Choose the area your place is in.';
      if (!l.rent || l.rent <= 0) return 'Enter the monthly rent.';
      if (l.deposit == null || l.deposit < 0) return 'Enter the deposit (0 if none).';
      if (!isValidISODate(l.available_from)) return 'Choose when the room is available.';
      if (parseISODate(l.available_from) < startOfToday()) return 'Available-from date can’t be in the past.';
      if (!l.occupancy || l.occupancy < 1 || l.occupancy > LIMITS.maxOccupancy) return 'Enter the occupancy.';
      if (l.furnished == null) return 'Tell us if it’s furnished.';
      return null;
    }
    case 'room_photos': {
      const n = countPhotos(data, true);
      return n >= ROOM_PHOTO_LIMITS.min ? null : 'Add at least one photo of the room.';
    }
  }
}
