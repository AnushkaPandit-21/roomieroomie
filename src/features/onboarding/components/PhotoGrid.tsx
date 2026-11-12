import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';

import { Icon, IconButton, Text } from '@/components/ui';
import { colors, radius } from '@/constants/theme';
import { useResponsive } from '@/hooks/useResponsive';
import { friendlyError } from '@/services/errors';
import { signPhotoUrls } from '@/services/photos';
import { getSupabase } from '@/services/supabase';

import { deletePhoto, nextPhotoPosition, uploadPhoto } from '../api';
import { pickImages, prepareWebp } from '../image';
import type { PhotoRow } from '../types';

type PhotoGridProps = {
  userId: string;
  allPhotos: PhotoRow[];
  isRoomPhoto: boolean;
  min: number;
  max: number;
  onChanged: () => Promise<unknown>;
  onBusyChange?: (busy: boolean) => void;
};

const COLUMNS = 3;
const GAP = 10;

// Photos are compressed and uploaded as soon as they're picked, so nothing is lost on back/close.
export function PhotoGrid({ userId, allPhotos, isRoomPhoto, min, max, onChanged, onBusyChange }: PhotoGridProps) {
  const { contentWidth } = useResponsive();
  const [uploading, setUploading] = useState(0);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [localUris, setLocalUris] = useState<Record<string, string>>({});

  const photos = allPhotos.filter((p) => p.is_room_photo === isRoomPhoto).sort((a, b) => a.position - b.position);
  const paths = photos.map((p) => p.url);

  const signed = useQuery({
    queryKey: ['photo-urls', ...paths],
    queryFn: () => signPhotoUrls(getSupabase(), paths),
    enabled: paths.some((p) => !localUris[p]),
    staleTime: 50 * 60 * 1000,
  });

  const slotSize = (contentWidth - GAP * (COLUMNS - 1)) / COLUMNS;
  const remaining = max - photos.length - uploading;

  const setBusy = (n: number) => {
    setUploading(n);
    onBusyChange?.(n > 0);
  };

  const add = async () => {
    setError(null);
    let assets;
    try {
      assets = await pickImages(remaining);
    } catch (e) {
      setError(friendlyError(e));
      return;
    }
    if (!assets.length) return;

    setBusy(assets.length);
    let position = nextPhotoPosition(allPhotos, isRoomPhoto);
    let left = assets.length;
    for (const asset of assets) {
      try {
        const prepared = await prepareWebp(asset);
        const row = await uploadPhoto(getSupabase(), userId, prepared.bytes, { isRoomPhoto, position });
        position += 1;
        setLocalUris((prev) => ({ ...prev, [row.url]: prepared.uri }));
      } catch (e) {
        setError(friendlyError(e));
      } finally {
        left -= 1;
        setBusy(left);
      }
    }
    await onChanged();
  };

  const remove = (photo: PhotoRow) => {
    Alert.alert('Remove this photo?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setError(null);
          setRemovingId(photo.id);
          try {
            await deletePhoto(getSupabase(), photo);
            await onChanged();
          } catch (e) {
            setError(friendlyError(e));
          } finally {
            setRemovingId(null);
          }
        },
      },
    ]);
  };

  const slots = Array.from({ length: max }, (_, i) => i);

  return (
    <View>
      <View className="flex-row flex-wrap" style={{ gap: GAP }}>
        {slots.map((i) => {
          const photo = photos[i];
          const box = { width: slotSize, height: slotSize * 1.25, borderRadius: radius.lg };

          if (photo) {
            const uri = localUris[photo.url] ?? signed.data?.[photo.url];
            return (
              <View key={photo.id} style={[box, { overflow: 'hidden', backgroundColor: colors['surface-muted'] }]}>
                {uri ? (
                  <Image source={{ uri }} style={{ flex: 1 }} contentFit="cover" transition={150} />
                ) : (
                  <View className="flex-1 items-center justify-center">
                    <ActivityIndicator color={colors['ink-muted']} />
                  </View>
                )}
                <View className="absolute right-1.5 top-1.5">
                  <IconButton
                    icon="close"
                    accessibilityLabel={`Remove photo ${i + 1}`}
                    variant="surface"
                    size="sm"
                    disabled={removingId === photo.id || uploading > 0}
                    onPress={() => remove(photo)}
                  />
                </View>
              </View>
            );
          }

          const isUploadingSlot = i < photos.length + uploading;
          if (isUploadingSlot) {
            return (
              <View key={`up-${i}`} style={box} className="items-center justify-center bg-surface-muted">
                <ActivityIndicator color={colors.brand} />
                <Text variant="caption" tone="muted" style={{ marginTop: 6 }}>
                  Uploading
                </Text>
              </View>
            );
          }

          const required = i < min;
          return (
            <Pressable
              key={`empty-${i}`}
              onPress={add}
              disabled={uploading > 0}
              accessibilityRole="button"
              accessibilityLabel={required ? `Add required photo ${i + 1}` : `Add photo ${i + 1}`}
            >
              {({ pressed }) => (
                <View
                  style={[box, { borderWidth: 1.5, borderStyle: 'dashed', borderColor: required ? colors['line-strong'] : colors.line }]}
                  className={pressed ? 'items-center justify-center bg-surface-muted' : 'items-center justify-center bg-surface'}
                >
                  <Icon name="add" size={28} color={required ? 'ink' : 'ink-subtle'} />
                  {required ? (
                    <Text variant="caption" tone="muted">
                      Required
                    </Text>
                  ) : null}
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      <Text variant="caption" tone="muted" style={{ marginTop: 12 }}>
        {photos.length} of {max} added{photos.length < min ? ` · ${min - photos.length} more needed` : ''}
      </Text>
      {error ? (
        <Text variant="caption" tone="danger" style={{ marginTop: 6 }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
