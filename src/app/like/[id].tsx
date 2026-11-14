import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { BackHeader, EmptyState, Screen } from '@/components/layout';
import { ProfileCard } from '@/components/profile/ProfileCard';
import { Button, Card, IconButton, Photo, Text } from '@/components/ui';
import { DAILY_LIMIT_MESSAGE, isDailyLimitError } from '@/features/feed/api';
import { LikeSheet } from '@/features/feed/components/LikeSheet';
import { MatchModal } from '@/features/feed/components/MatchModal';
import type { LikedItem } from '@/features/feed/types';
import { resolveMyItem } from '@/features/likes/labels';
import type { IncomingLike } from '@/features/likes/types';
import { useLikesYou, useRespondToLike } from '@/features/likes/useLikesYou';
import { useOnboardingData } from '@/features/onboarding/useOnboardingData';
import { useProfilePhotoUrls, useSignedPhotoUrls } from '@/hooks/usePhotoUrls';
import { friendlyError } from '@/services/errors';
import { useSessionStore } from '@/stores/sessionStore';

// What of mine they liked, and their comment, above their card.
function LikedBanner({ like, myPhotoUri, item }: { like: IncomingLike; myPhotoUri?: string; item: ReturnType<typeof resolveMyItem> }) {
  return (
    <Card className="mb-4">
      <Text variant="label" tone="muted">
        {item?.kind === 'photo' ? 'Liked your photo' : item?.kind === 'prompt' ? 'Liked your answer' : 'Liked your profile'}
      </Text>
      <View className="mt-3 flex-row gap-3">
        {item?.kind === 'photo' ? (
          <View className="w-16">
            <Photo source={myPhotoUri ? { uri: myPhotoUri } : undefined} rounded="md" />
          </View>
        ) : null}
        <View className="flex-1 justify-center">
          {item?.kind === 'prompt' ? (
            <>
              <Text variant="caption" tone="muted">
                {item.question}
              </Text>
              <Text variant="bodyStrong" numberOfLines={3}>
                {item.answer}
              </Text>
            </>
          ) : null}
          {like.comment ? (
            <Text variant="heading" style={{ marginTop: item?.kind === 'prompt' ? 8 : 0 }}>
              “{like.comment}”
            </Text>
          ) : item?.kind !== 'prompt' ? (
            <Text tone="muted">No comment</Text>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

// A person from Likes You: their full card with Like back (instant match) or Cross.
export default function IncomingLikeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useSessionStore((s) => s.session?.user.id) as string;
  const mine = useOnboardingData(userId).data;
  const { likes } = useLikesYou(userId);

  // Keep the like after answering removes it from the list, so the screen can show the match.
  const [like] = useState<IncomingLike | undefined>(() => likes.find((l) => l.profile.id === id));
  const [liking, setLiking] = useState<LikedItem | null>(null);
  const [match, setMatch] = useState<{ matchId: string | null } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const respond = useRespondToLike(userId, {
    onMatch: (_profile, matchId) => setMatch({ matchId }),
    onError: (error) => setNotice(isDailyLimitError(error) ? DAILY_LIMIT_MESSAGE : friendlyError(error)),
  });

  const photoUrls = useProfilePhotoUrls(like?.profile ?? null);
  const urls = photoUrls.data ?? {};
  const myItem = resolveMyItem(like?.likedItemId ?? null, mine);
  const myPhoto = useSignedPhotoUrls(myItem?.kind === 'photo' ? [myItem.url] : []);

  if (!like) {
    return (
      <Screen header={<BackHeader title="Likes You" />} scroll={false} edges={{ top: true, bottom: true }}>
        <EmptyState icon="heart-dislike-outline" title="This like is no longer available" />
      </Screen>
    );
  }

  const { profile } = like;
  const likeBack = (likedItemId?: string, comment?: string) =>
    respond.mutate(
      { kind: 'like', profile, likedItemId, comment },
      { onSuccess: (result) => !result.matched && router.back() },
    );

  return (
    <Screen header={<BackHeader title={profile.name} subtitle="Likes you" />} scroll={false} edges={{ top: true, bottom: true }}>
      {notice ? (
        <View className="mb-3 rounded-lg bg-ink px-4 py-3" accessibilityLiveRegion="polite">
          <Text variant="label" tone="inverse">
            {notice}
          </Text>
        </View>
      ) : null}
      <View className="flex-1">
        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 112 }} showsVerticalScrollIndicator={false}>
          <LikedBanner like={like} item={myItem} myPhotoUri={myItem?.kind === 'photo' ? myPhoto.data?.[myItem.url] : undefined} />
          <ProfileCard profile={profile} photoUrls={urls} onLike={setLiking} />
        </ScrollView>
        <View className="absolute bottom-4 left-0 right-0 flex-row items-center justify-between">
          <IconButton
            icon="close"
            accessibilityLabel={`Cross ${profile.name}`}
            variant="surface"
            size="lg"
            floating
            disabled={respond.isPending}
            onPress={() => {
              respond.mutate({ kind: 'cross', profile });
              router.back();
            }}
          />
          <Button label="Like back" leftIcon="heart" loading={respond.isPending} onPress={() => likeBack()} />
        </View>
      </View>

      <LikeSheet
        item={liking}
        name={profile.name}
        photoUri={liking?.kind === 'photo' ? urls[liking.photo.url] : undefined}
        onClose={() => setLiking(null)}
        onSend={(comment) => {
          if (liking) likeBack(liking.kind === 'photo' ? liking.photo.id : liking.prompt.id, comment);
          setLiking(null);
        }}
      />
      <MatchModal
        name={match ? profile.name : null}
        photoUri={profile.photos[0] ? urls[profile.photos[0].url] : undefined}
        closeLabel="Back to Likes You"
        onClose={() => {
          setMatch(null);
          router.back();
        }}
      />
    </Screen>
  );
}
