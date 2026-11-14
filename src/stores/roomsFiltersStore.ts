import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { NO_FILTERS, type FeedFilters } from '@/features/feed/types';

// Rooms filters (area, max rent, available by) are remembered on the device, like Discover's.
type RoomsFiltersState = {
  filters: FeedFilters;
  setFilters: (filters: FeedFilters) => void;
};

export const useRoomsFilters = create<RoomsFiltersState>()(
  persist(
    (set) => ({
      filters: NO_FILTERS,
      setFilters: (filters) => set({ filters }),
    }),
    {
      name: 'roomieroomie.rooms-filters',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ filters: state.filters }),
    },
  ),
);
