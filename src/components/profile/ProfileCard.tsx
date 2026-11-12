import { View } from 'react-native';

import { Card, Chip, Icon, IconButton, Photo, Text } from '@/components/ui';
import { colors } from '@/constants/theme';
import { buildCardSections, lifestyleChips } from '@/features/feed/card';
import type { CardPhoto, CardPrompt, CardProfile, LikedItem } from '@/features/feed/types';
import { formatDisplayDate } from '@/utils/date';
import { formatRupees } from '@/utils/format';

type ProfileCardProps = {
  profile: CardProfile;
  photoUrls: Record<string, string>;
  // When provided, every photo and prompt gets a heart that likes that specific item.
  onLike?: (item: LikedItem) => void;
};

function LikeHeart({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <IconButton icon="heart-outline" iconColor="brand" accessibilityLabel={label} variant="surface" floating onPress={onPress} />
  );
}

function PhotoSection({ photo, uri, name, onLike }: { photo: CardPhoto; uri?: string; name: string; onLike?: ProfileCardProps['onLike'] }) {
  return (
    <View>
      <Photo source={uri ? { uri } : undefined} accessibilityLabel={`Photo of ${name}`} />
      {onLike ? (
        <View className="absolute bottom-3 right-3">
          <LikeHeart label={`Like ${name}'s photo`} onPress={() => onLike({ kind: 'photo', photo })} />
        </View>
      ) : null}
    </View>
  );
}

function PromptSection({ prompt, name, onLike }: { prompt: CardPrompt; name: string; onLike?: ProfileCardProps['onLike'] }) {
  return (
    <Card>
      <Text variant="label" tone="muted">
        {prompt.question}
      </Text>
      <Text variant="heading" style={{ marginTop: 8, paddingRight: onLike ? 48 : 0 }}>
        {prompt.answer}
      </Text>
      {onLike ? (
        <View className="absolute bottom-3 right-3">
          <LikeHeart label={`Like ${name}'s answer: ${prompt.question}`} onPress={() => onLike({ kind: 'prompt', prompt })} />
        </View>
      ) : null}
    </Card>
  );
}

function RoomPanel({ profile }: { profile: CardProfile }) {
  const l = profile.listing!;
  const details = [
    l.occupancy == null ? null : l.occupancy === 1 ? 'Private room' : `${l.occupancy} sharing`,
    l.furnished == null ? null : l.furnished ? 'Furnished' : 'Unfurnished',
    l.deposit ? `${formatRupees(l.deposit)} deposit` : null,
  ].filter(Boolean);

  return (
    <Card elevated={false} style={{ backgroundColor: colors['accent-soft'] }}>
      <View className="flex-row items-center gap-2">
        <Icon name="home" size={18} color="accent" />
        <Text variant="overline" tone="accent">
          Has a room
        </Text>
      </View>
      <Text variant="heading" style={{ marginTop: 8 }}>
        {l.area} · {formatRupees(l.rent)}/mo
      </Text>
      <Text tone="muted" style={{ marginTop: 4 }}>
        Available from {formatDisplayDate(l.available_from)}
      </Text>
      {details.length ? (
        <Text variant="caption" tone="muted" style={{ marginTop: 4 }}>
          {details.join(' · ')}
        </Text>
      ) : null}
    </Card>
  );
}

// Hinge-style vertical profile: photos interleaved with prompts, lifestyle chips and the match %.
export function ProfileCard({ profile, photoUrls, onLike }: ProfileCardProps) {
  const sections = buildCardSections(profile);

  return (
    <View className="gap-4">
      <View className="flex-row items-end justify-between">
        <View className="flex-1 pr-3">
          <Text variant="display" accessibilityRole="header">
            {profile.name}, {profile.age}
          </Text>
          {profile.occupation ? <Text tone="muted">{profile.occupation}</Text> : null}
        </View>
        {profile.matchScore != null ? (
          <View className="rounded-pill bg-brand-soft px-3 py-1.5" accessibilityLabel={`${profile.matchScore}% match`}>
            <Text variant="label" tone="brand">
              {profile.matchScore}% match
            </Text>
          </View>
        ) : null}
      </View>

      {sections.map((section, i) => {
        switch (section.type) {
          case 'photo':
            return (
              <PhotoSection
                key={section.photo.id}
                photo={section.photo}
                uri={photoUrls[section.photo.url]}
                name={profile.name}
                onLike={onLike}
              />
            );
          case 'prompt':
            return <PromptSection key={section.prompt.id} prompt={section.prompt} name={profile.name} onLike={onLike} />;
          case 'chips':
            return (
              <View key={`chips-${i}`} className="flex-row flex-wrap gap-2">
                {lifestyleChips(profile).map((chip) => (
                  <Chip key={chip.label} label={chip.label} icon={chip.icon} />
                ))}
              </View>
            );
          case 'room':
            return <RoomPanel key={`room-${i}`} profile={profile} />;
        }
      })}
    </View>
  );
}
