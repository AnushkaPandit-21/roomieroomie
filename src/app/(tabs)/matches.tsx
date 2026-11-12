import { EmptyState, Screen, ScreenHeader } from '@/components/layout';

export default function MatchesScreen() {
  return (
    <Screen header={<ScreenHeader title="Matches" />}>
      <EmptyState
        icon="chatbubbles-outline"
        title="Matches"
        description="New matches and your conversations will appear here."
      />
    </Screen>
  );
}
