import { BUDGET } from './options';
import type { Answers, OnboardingData } from './types';

export function emptyAnswers(): Answers {
  return {
    name: '',
    dob: null,
    gender: null,
    want_genders: [],
    show_to_genders: [],
    city: null,
    areas: [],
    seeking_type: null,
    max_budget: BUDGET.initial,
    move_in_date: null,
    food: null,
    smoking: null,
    drinking: null,
    sleep: null,
    cleanliness: null,
    guests: null,
    pets: null,
    language: [],
    dealbreakers: [],
    occupation: '',
    prompts: [
      { question: '', answer: '' },
      { question: '', answer: '' },
      { question: '', answer: '' },
    ],
    listing: {
      area: null,
      rent: null,
      deposit: null,
      available_from: null,
      occupancy: null,
      furnished: null,
      amenities: [],
    },
  };
}

export function answersFromData(data: OnboardingData): Answers {
  const base = emptyAnswers();
  const { profile: p, preferences: pr, listing: l } = data;

  return {
    name: p?.name ?? base.name,
    dob: p?.dob ?? base.dob,
    gender: p?.gender ?? base.gender,
    want_genders: p?.want_genders ?? base.want_genders,
    show_to_genders: p?.show_to_genders ?? base.show_to_genders,
    city: p?.city ?? base.city,
    areas: p?.areas ?? base.areas,
    seeking_type: p?.seeking_type ?? base.seeking_type,
    max_budget: p?.max_budget ?? base.max_budget,
    move_in_date: p?.move_in_date ?? base.move_in_date,
    food: pr?.food ?? base.food,
    smoking: pr?.smoking ?? base.smoking,
    drinking: pr?.drinking ?? base.drinking,
    sleep: pr?.sleep ?? base.sleep,
    cleanliness: pr?.cleanliness ?? base.cleanliness,
    guests: pr?.guests ?? base.guests,
    pets: pr?.pets ?? base.pets,
    language: pr?.language ?? base.language,
    dealbreakers: pr?.dealbreakers ?? base.dealbreakers,
    occupation: p?.occupation ?? base.occupation,
    prompts: base.prompts.map((empty, i) => {
      const saved = data.prompts.find((q) => q.position === i + 1);
      return saved ? { question: saved.question, answer: saved.answer } : empty;
    }),
    listing: l
      ? {
          area: l.area,
          rent: l.rent,
          deposit: l.deposit,
          available_from: l.available_from,
          occupancy: l.occupancy,
          furnished: l.furnished,
          amenities: l.amenities,
        }
      : base.listing,
  };
}

function isBlank(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

// Server answers win; a locally persisted draft only fills fields the server doesn't have yet
// (e.g. half-written prompts when the app was closed).
export function mergeDraft(server: Answers, local: Answers | null): Answers {
  if (!local) return server;
  const merged = { ...server };

  (Object.keys(server) as (keyof Answers)[]).forEach((key) => {
    if (key === 'prompts' || key === 'listing') return;
    if (isBlank(server[key]) && !isBlank(local[key])) {
      (merged as Record<keyof Answers, unknown>)[key] = local[key];
    }
  });

  merged.prompts = server.prompts.map((p, i) =>
    isBlank(p.question) && isBlank(p.answer) && local.prompts[i] ? local.prompts[i] : p,
  );

  const serverHasListing = server.listing.area != null || server.listing.rent != null;
  merged.listing = serverHasListing ? server.listing : local.listing;

  return merged;
}
