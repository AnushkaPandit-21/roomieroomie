import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Card, Chip, Icon, Photo, Text } from '@/components/ui';
import { colors } from '@/constants/theme';
import { buildCardSections, lifestyleChips } from '@/features/feed/card';
import type { CardPrompt, CardProfile } from '@/features/feed/types';
import { formatDisplayDate } from '@/utils/date';
import { formatRupees } from '@/utils/format';

type ProfileCardProps = {
  profile: CardProfile;
  photoUrls: Record<string, string>;
  // Shown next to the match %, e.g. the report/block menu.
  headerAction?: ReactNode;
};

function PhotoSection({ uri, name }: { uri?: string; name: string }) {
  return <Photo source={uri ? { uri } : undefined} accessibilityLabel={`Photo of ${name}`} />;
}

function PromptSection({ prompt }: { prompt: CardPrompt }) {
  return (
    <Card>
      <Text variant="label" tone="muted">
        {prompt.question}
      </Text>
      <Text variant="heading" style={{ marginTop: 8 }}>
        {prompt.answer}
      </Text>
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
export function ProfileCard({ profile, photoUrls, headerAction }: ProfileCardProps) {
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
        <View className="flex-row items-center gap-1">
          {profile.matchScore != null ? (
            <View className="rounded-pill bg-brand-soft px-3 py-1.5" accessibilityLabel={`${profile.matchScore}% match`}>
              <Text variant="label" tone="brand">
                {profile.matchScore}% match
              </Text>
            </View>
          ) : null}
          {headerAction}
        </View>
      </View>

      {sections.map((section, i) => {
        switch (section.type) {
          case 'photo':
            return <PhotoSection key={section.photo.id} uri={photoUrls[section.photo.url]} name={profile.name} />;
          case 'prompt':
            return <PromptSection key={section.prompt.id} prompt={section.prompt} />;
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

