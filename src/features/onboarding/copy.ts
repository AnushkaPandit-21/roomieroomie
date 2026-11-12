import type { StepId } from './steps';

type StepCopy = { overline?: string; title: string; subtitle?: string };

export const PHONE_COPY: StepCopy = {
  title: "What's your phone number?",
  subtitle: "We'll text you a code to verify it.",
};

export const VERIFY_COPY: StepCopy = {
  title: 'Enter your code',
};

export const STEP_COPY: Record<StepId, StepCopy> = {
  name_dob: { title: "What's your name?", subtitle: 'And your date of birth. You must be 18 or older.' },
  gender: { title: 'Which gender best describes you?' },
  want_genders: { title: 'Who do you want to live with?', subtitle: 'Select all that apply.' },
  show_to_genders: {
    title: 'Who can see your profile?',
    subtitle: 'Only people you select will see you in their feed.',
  },
  city_areas: { title: 'Where do you want to live?', subtitle: 'Pick your city, then the areas that work for you.' },
  seeking_type: { title: 'Are you looking for a place, or do you have one?' },
  max_budget: { title: "What's your maximum budget?", subtitle: 'Your monthly share of the rent.' },
  move_in_date: { title: 'When do you want to move in?' },
  food: { overline: 'Lifestyle', title: 'What do you eat?' },
  smoking: { overline: 'Lifestyle', title: 'Do you smoke?' },
  drinking: { overline: 'Lifestyle', title: 'Do you drink?' },
  sleep: { overline: 'Lifestyle', title: "What's your sleep schedule?" },
  cleanliness: { overline: 'Lifestyle', title: 'How tidy are you?' },
  guests: { overline: 'Lifestyle', title: 'How often do you have guests over?' },
  pets: { overline: 'Lifestyle', title: 'What about pets?' },
  languages: { overline: 'Lifestyle', title: 'Which languages do you speak?', subtitle: 'Select all that apply.' },
  dealbreakers: {
    title: 'Any dealbreakers?',
    subtitle: 'Marked answers must match exactly for someone to appear in your feed. This is optional.',
  },
  occupation: { title: 'What do you do?' },
  photos: { title: 'Add your photos', subtitle: 'Add 3 to 6 photos of yourself.' },
  prompts: { title: 'Answer 3 prompts', subtitle: 'Help people get a feel for you as a roommate.' },
  listing: {
    overline: 'Your place',
    title: 'Tell us about the room',
    subtitle: 'Only the area is shown, never your exact address.',
  },
  room_photos: { overline: 'Your place', title: 'Add photos of the room', subtitle: 'Add at least one photo.' },
};
