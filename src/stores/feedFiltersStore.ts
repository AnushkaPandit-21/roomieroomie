import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { NO_FILTERS, type FeedFilters } from '@/features/feed/types';

// Discover filters are remembered on the device (F1).
type FiltersState = {
  filters: FeedFilters;
  setFilters: (filters: FeedFilters) => void;
  reset: () => void;
};

export const useFeedFilters = create<FiltersState>()(
  persist(
    (set) => ({
      filters: NO_FILTERS,
      setFilters: (filters) => set({ filters }),
      reset: () => set({ filters: NO_FILTERS }),
    }),
    {
      name: 'roomieroomie.feed-filters',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ filters: state.filters }),
    },
  ),
);
