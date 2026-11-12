import { View } from 'react-native';

import { ChipGroup, DateField, Input, OptionList, Text } from '@/components/ui';
import { addDays, addYears, startOfToday } from '@/utils/date';

import {
  CITIES,
  CLEANLINESS_OPTIONS,
  DEALBREAKER_LABELS,
  DRINKING_OPTIONS,
  FOOD_OPTIONS,
  GENDER_OPTIONS,
  GUESTS_OPTIONS,
  LANGUAGES,
  LIMITS,
  PETS_OPTIONS,
  PHOTO_LIMITS,
  ROOM_PHOTO_LIMITS,
  SEEKING_OPTIONS,
  SLEEP_OPTIONS,
  SMOKING_OPTIONS,
  type Option,
} from '../options';
import type { StepId } from '../steps';
import type { Answers, OnboardingData } from '../types';
import type { DealbreakerField } from '@/types/domain';

import { BudgetSlider } from './BudgetSlider';
import { ListingForm } from './ListingForm';
import { PhotoGrid } from './PhotoGrid';
import { PromptEditor } from './PromptEditor';

type StepContentProps = {
  step: StepId;
  answers: Answers;
  update: (patch: Partial<Answers>) => void;
  userId: string;
  data: OnboardingData;
  refresh: () => Promise<unknown>;
  onBusyChange: (busy: boolean) => void;
};

function labelFor<T>(options: Option<T>[], value: T | null): string {
  return options.find((o) => o.value === value)?.label ?? 'Not answered';
}

const DEALBREAKER_ANSWERS: Record<DealbreakerField, (a: Answers) => string> = {
  food: (a) => labelFor(FOOD_OPTIONS, a.food),
  smoking: (a) => labelFor(SMOKING_OPTIONS, a.smoking),
  drinking: (a) => labelFor(DRINKING_OPTIONS, a.drinking),
  sleep: (a) => labelFor(SLEEP_OPTIONS, a.sleep),
  guests: (a) => labelFor(GUESTS_OPTIONS, a.guests),
  pets: (a) => labelFor(PETS_OPTIONS, a.pets),
};

export function StepContent({ step, answers: a, update, userId, data, refresh, onBusyChange }: StepContentProps) {
  const today = startOfToday();

  switch (step) {
    case 'name_dob':
      return (
        <View className="gap-5">
          <Input
            label="First name"
            value={a.name}
            onChangeText={(name) => update({ name })}
            autoCapitalize="words"
            autoComplete="given-name"
            textContentType="givenName"
            maxLength={LIMITS.name}
            placeholder="Your first name"
          />
          <DateField
            label="Date of birth"
            value={a.dob}
            onChange={(dob) => update({ dob })}
            maximumDate={addYears(today, -18)}
            minimumDate={addYears(today, -100)}
            initialDate={addYears(today, -24)}
          />
        </View>
      );
    case 'gender':
      return <OptionList options={GENDER_OPTIONS} value={a.gender} onChange={(gender) => update({ gender })} />;
    case 'want_genders':
      return (
        <OptionList
          multiple
          options={GENDER_OPTIONS}
          value={a.want_genders}
          onChange={(want_genders) => update({ want_genders })}
        />
      );
    case 'show_to_genders':
      return (
        <OptionList
          multiple
          options={GENDER_OPTIONS}
          value={a.show_to_genders}
          onChange={(show_to_genders) => update({ show_to_genders })}
        />
      );
    case 'city_areas': {
      const city = CITIES.find((c) => c.name === a.city);
      return (
        <View className="gap-6">
          <ChipGroup
            options={CITIES.map((c) => ({ value: c.name, label: c.name }))}
            value={a.city}
            onChange={(name) => {
              const next = CITIES.find((c) => c.name === name)!;
              update({ city: name, areas: a.areas.filter((area) => next.areas.includes(area)) });
            }}
          />
          {city ? (
            <View className="gap-3">
              <Text variant="subheading">Preferred areas</Text>
              <ChipGroup
                multiple
                options={city.areas.map((area) => ({ value: area, label: area }))}
                value={a.areas}
                onChange={(areas) => update({ areas })}
              />
            </View>
          ) : null}
        </View>
      );
    }
    case 'seeking_type':
      return (
        <OptionList
          options={SEEKING_OPTIONS}
          value={a.seeking_type}
          onChange={(seeking_type) => update({ seeking_type })}
        />
      );
    case 'max_budget':
      return <BudgetSlider value={a.max_budget} onChange={(max_budget) => update({ max_budget })} />;
    case 'move_in_date':
      return (
        <DateField
          label="Move-in date"
          value={a.move_in_date}
          onChange={(move_in_date) => update({ move_in_date })}
          minimumDate={today}
          maximumDate={addDays(today, LIMITS.moveInWindowDays)}
        />
      );
    case 'food':
      return <OptionList options={FOOD_OPTIONS} value={a.food} onChange={(food) => update({ food })} />;
    case 'smoking':
      return <OptionList options={SMOKING_OPTIONS} value={a.smoking} onChange={(smoking) => update({ smoking })} />;
    case 'drinking':
      return <OptionList options={DRINKING_OPTIONS} value={a.drinking} onChange={(drinking) => update({ drinking })} />;
    case 'sleep':
      return <OptionList options={SLEEP_OPTIONS} value={a.sleep} onChange={(sleep) => update({ sleep })} />;
    case 'cleanliness':
      return (
        <OptionList
          options={CLEANLINESS_OPTIONS}
          value={a.cleanliness}
          onChange={(cleanliness) => update({ cleanliness })}
        />
      );
    case 'guests':
      return <OptionList options={GUESTS_OPTIONS} value={a.guests} onChange={(guests) => update({ guests })} />;
    case 'pets':
      return <OptionList options={PETS_OPTIONS} value={a.pets} onChange={(pets) => update({ pets })} />;
    case 'languages':
      return (
        <ChipGroup
          multiple
          options={LANGUAGES.map((l) => ({ value: l, label: l }))}
          value={a.language}
          onChange={(language) => update({ language })}
        />
      );
    case 'dealbreakers':
      return (
        <OptionList
          multiple
          options={(Object.keys(DEALBREAKER_LABELS) as DealbreakerField[]).map((field) => ({
            value: field,
            label: DEALBREAKER_LABELS[field],
            description: `Your answer: ${DEALBREAKER_ANSWERS[field](a)}`,
          }))}
          value={a.dealbreakers}
          onChange={(dealbreakers) => update({ dealbreakers })}
        />
      );
    case 'occupation':
      return (
        <Input
          label="Job title or what you study"
          value={a.occupation}
          onChangeText={(occupation) => update({ occupation })}
          maxLength={LIMITS.occupation}
          placeholder="e.g. Software Engineer"
          autoCapitalize="words"
        />
      );
    case 'photos':
    case 'room_photos': {
      const isRoom = step === 'room_photos';
      const limits = isRoom ? ROOM_PHOTO_LIMITS : PHOTO_LIMITS;
      return (
        <PhotoGrid
          userId={userId}
          allPhotos={data.photos}
          isRoomPhoto={isRoom}
          min={limits.min}
          max={limits.max}
          onChanged={refresh}
          onBusyChange={onBusyChange}
        />
      );
    }
    case 'prompts':
      return <PromptEditor prompts={a.prompts} onChange={(prompts) => update({ prompts })} />;
    case 'listing':
      return <ListingForm city={a.city} listing={a.listing} onChange={(listing) => update({ listing })} />;
  }
}
