import type { ReactNode } from 'react';
import { View } from 'react-native';

import { ChipGroup, DateField, Input, Text } from '@/components/ui';
import { addDays, startOfToday } from '@/utils/date';

import { AMENITIES, CITIES, LIMITS } from '../options';
import type { ListingDraft } from '../types';

type ListingFormProps = {
  city: string | null;
  listing: ListingDraft;
  onChange: (listing: ListingDraft) => void;
};

function toAmount(text: string): number | null {
  const digits = text.replace(/\D/g, '');
  return digits ? Number(digits) : null;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View className="gap-2">
      <Text variant="label" tone="muted">
        {label}
      </Text>
      {children}
    </View>
  );
}

const OCCUPANCY_OPTIONS = [1, 2, 3, 4, 5, 6].map((n) => ({ value: n, label: n === 1 ? '1 (private)' : String(n) }));

export function ListingForm({ city, listing, onChange }: ListingFormProps) {
  const set = (patch: Partial<ListingDraft>) => onChange({ ...listing, ...patch });
  const areas = CITIES.find((c) => c.name === city)?.areas ?? [];

  return (
    <View className="gap-6">
      <Field label="Area">
        <ChipGroup options={areas.map((a) => ({ value: a, label: a }))} value={listing.area} onChange={(area) => set({ area })} />
      </Field>

      <Input
        label="Monthly rent for this room (₹)"
        helper="What the new roommate pays each month."
        keyboardType="number-pad"
        value={listing.rent != null ? String(listing.rent) : ''}
        onChangeText={(t) => set({ rent: toAmount(t) })}
        maxLength={7}
      />

      <Input
        label="Deposit (₹)"
        helper="Enter 0 if there's no deposit."
        keyboardType="number-pad"
        value={listing.deposit != null ? String(listing.deposit) : ''}
        onChangeText={(t) => set({ deposit: toAmount(t) })}
        maxLength={8}
      />

      <DateField
        label="Available from"
        value={listing.available_from}
        onChange={(available_from) => set({ available_from })}
        minimumDate={startOfToday()}
        maximumDate={addDays(startOfToday(), LIMITS.moveInWindowDays)}
      />

      <Field label="Occupancy (people sharing the room)">
        <ChipGroup options={OCCUPANCY_OPTIONS} value={listing.occupancy} onChange={(occupancy) => set({ occupancy })} />
      </Field>

      <Field label="Furnished">
        <ChipGroup
          options={[
            { value: 'yes', label: 'Furnished' },
            { value: 'no', label: 'Unfurnished' },
          ]}
          value={listing.furnished == null ? null : listing.furnished ? 'yes' : 'no'}
          onChange={(v) => set({ furnished: v === 'yes' })}
        />
      </Field>

      <Field label="Amenities (optional)">
        <ChipGroup
          multiple
          options={AMENITIES.map((a) => ({ value: a, label: a }))}
          value={listing.amenities}
          onChange={(amenities) => set({ amenities })}
        />
      </Field>
    </View>
  );
}
