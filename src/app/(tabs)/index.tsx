import { useState } from 'react';

import { EmptyState, Screen, ScreenHeader } from '@/components/layout';
import { IconButton, Sheet, Text } from '@/components/ui';

export default function DiscoverScreen() {
  const [filtersOpen, setFiltersOpen] = useState(false);

  return (
    <Screen
      header={
        <ScreenHeader
          title="Discover"
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
        icon="albums-outline"
        title="Discover"
        description="Profiles will appear here one at a time once the feed is connected."
      />
      <Sheet visible={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filters">
        <Text tone="muted">Area, budget and move-in filters will be added with the feed.</Text>
      </Sheet>
    </Screen>
  );
}
