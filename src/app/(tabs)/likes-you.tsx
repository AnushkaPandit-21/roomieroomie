import { EmptyState, Screen, ScreenHeader } from '@/components/layout';

export default function LikesYouScreen() {
  return (
    <Screen header={<ScreenHeader title="Likes You" />}>
      <EmptyState
        icon="heart-outline"
        title="Likes You"
        description="People who like you will appear here, with the photo or prompt they liked."
      />
    </Screen>
  );
}
