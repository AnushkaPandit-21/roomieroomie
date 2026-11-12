import { useState } from 'react';

import { EmptyState, Screen, ScreenHeader } from '@/components/layout';
import { IconButton, Sheet, Text } from '@/components/ui';

export default function RoomsScreen() {
  const [filtersOpen, setFiltersOpen] = useState(false);

  return (
    <Screen
      header={
        <ScreenHeader
          title="Rooms"
          right={
            <IconButton
              icon="options-outline"
              accessibilityLabel="Filters"
              variant="surface"
              onPress={() => setFiltersOpen(true)}
            />
          }
        />
      }
    >
      <EmptyState
        icon="home-outline"
        title="Rooms"
        description="Hosts with a room available will appear here once listings are connected."
      />
      <Sheet visible={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filters">
        <Text tone="muted">Area, rent and date filters will be added with listings.</Text>
      </Sheet>
    </Screen>
  );
}
