import Slider from '@react-native-community/slider';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { Button, Chip, ChipGroup, DateField, Sheet, Text } from '@/components/ui';
import { colors } from '@/constants/theme';
import { BUDGET, CITIES, LIMITS } from '@/features/onboarding/options';
import { addDays, startOfToday } from '@/utils/date';
import { formatRupees } from '@/utils/format';

import { NO_FILTERS, type FeedFilters } from '../types';

type FilterSheetProps = {
  visible: boolean;
  city: string | null;
  filters: FeedFilters;
  onApply: (filters: FeedFilters) => void;
  onClose: () => void;
};

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <View className="mb-7">
      <View className="mb-3 flex-row items-center justify-between">
        <Text variant="subheading">{title}</Text>
        {action}
      </View>
      {children}
    </View>
  );
}

function ClearLink({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button">
      <Text variant="label" tone="brand">
        Clear
      </Text>
    </Pressable>
  );
}

// Discover filters: areas, budget, move-in (F1). Changes apply only when "Show results" is tapped.
export function FilterSheet({ visible, city, filters, onApply, onClose }: FilterSheetProps) {
  const [draft, setDraft] = useState<FeedFilters>(filters);
  useEffect(() => {
    if (visible) setDraft(filters);
  }, [visible, filters]);

  const areas = CITIES.find((c) => c.name === city)?.areas ?? [];
  const today = startOfToday();

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Filters"
      footer={
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Button label="Reset" variant="outline" fullWidth onPress={() => setDraft(NO_FILTERS)} />
          </View>
          <View className="flex-1">
            <Button label="Show results" fullWidth onPress={() => onApply(draft)} />
          </View>
        </View>
      }
    >
      <Section
        title="Areas"
        action={draft.areas.length ? <ClearLink onPress={() => setDraft({ ...draft, areas: [] })} /> : null}
      >
        {areas.length ? (
          <ChipGroup
            multiple
            options={areas.map((a) => ({ value: a, label: a }))}
            value={draft.areas}
            onChange={(next) => setDraft({ ...draft, areas: next })}
          />
        ) : (
          <Text tone="muted">No areas available for your city.</Text>
        )}
      </Section>

      <Section title="Their budget, up to">
        <View className="flex-row items-center justify-between">
          <Text variant="heading">{draft.maxBudget == null ? 'Any budget' : formatRupees(draft.maxBudget)}</Text>
          <Chip
            label="Any"
            selected={draft.maxBudget == null}
            onPress={() => setDraft({ ...draft, maxBudget: draft.maxBudget == null ? BUDGET.initial : null })}
          />
        </View>
        <Slider
          style={{ width: '100%', height: 44, marginTop: 8 }}
          minimumValue={BUDGET.min}
          maximumValue={BUDGET.max}
          step={BUDGET.step}
          value={draft.maxBudget ?? BUDGET.max}
          onValueChange={(maxBudget) => setDraft((d) => ({ ...d, maxBudget }))}
          minimumTrackTintColor={draft.maxBudget == null ? colors['line-strong'] : colors.brand}
          maximumTrackTintColor={colors.line}
          thumbTintColor={colors.brand}
          accessibilityLabel="Maximum budget filter"
        />
      </Section>

      <Section
        title="Moving in by"
        action={draft.moveInBy ? <ClearLink onPress={() => setDraft({ ...draft, moveInBy: null })} /> : null}
      >
        <DateField
          value={draft.moveInBy}
          placeholder="Any date"
          onChange={(moveInBy) => setDraft({ ...draft, moveInBy })}
          minimumDate={today}
          maximumDate={addDays(today, LIMITS.moveInWindowDays)}
        />
      </Section>
    </Sheet>
  );
}
