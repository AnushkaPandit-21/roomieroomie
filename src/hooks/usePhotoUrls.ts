import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useEffect } from 'react';

import type { CardProfile } from '@/features/feed/types';
import { signPhotoUrls } from '@/services/photos';
import { getSupabase } from '@/services/supabase';

const allPaths = (p: CardProfile) => [...p.photos.map((x) => x.url), ...(p.listing?.room_photos.map((x) => x.url) ?? [])];

const photoUrlsQuery = (profile: CardProfile) => ({
  queryKey: ['profile-photo-urls', profile.id, ...allPaths(profile)],
  queryFn: () => signPhotoUrls(getSupabase(), allPaths(profile)),
  // Signed URLs last an hour; refresh a little before that.
  staleTime: 50 * 60 * 1000,
});

// Display URLs for a profile's photos (signed for private storage; seed URLs pass through).
export function useProfilePhotoUrls(profile: CardProfile | null) {
  return useQuery({
    ...(profile ? photoUrlsQuery(profile) : { queryKey: ['profile-photo-urls', 'none'], queryFn: async (): Promise<Record<string, string>> => ({}) }),
    enabled: !!profile,
  });
}

// Warms the next card: signs its URLs and downloads its images into the cache.
export function usePrefetchProfilePhotos(profile: CardProfile | null) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!profile) return;
    queryClient
      .fetchQuery(photoUrlsQuery(profile))
      .then((urls) => Image.prefetch(Object.values(urls)))
      .catch(() => undefined);
  }, [profile, queryClient]);
}
