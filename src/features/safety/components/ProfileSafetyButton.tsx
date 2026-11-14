import { useState } from 'react';
import { Alert } from 'react-native';

import { IconButton } from '@/components/ui';
import { friendlyError } from '@/services/errors';

import { useSafetyAction } from '../useSafety';
import { ActionSheet } from './ActionSheet';
import { ReportSheet } from './ReportSheet';

type ProfileSafetyButtonProps = {
  userId: string;
  target: { id: string; name: string };
  // After a report or block (the person disappears from every list).
  onDone?: () => void;
};

// "…" on every profile: report or block (CLAUDE.md §10).
export function ProfileSafetyButton({ userId, target, onDone }: ProfileSafetyButtonProps) {
  const safety = useSafetyAction(userId);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reporting, setReporting] = useState(false);

  const confirmBlock = () =>
    Alert.alert(`Block ${target.name}?`, 'You won’t see each other anywhere in RoomieRoomie again.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Block',
        style: 'destructive',
        onPress: () =>
          safety.mutate(
            { kind: 'block', targetId: target.id },
            { onSuccess: onDone, onError: (e) => Alert.alert('Something went wrong', friendlyError(e)) },
          ),
      },
    ]);

  return (
    <>
      <IconButton icon="ellipsis-horizontal" accessibilityLabel={`More options for ${target.name}`} size="sm" onPress={() => setMenuOpen(true)} />
      <ActionSheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        title={target.name}
        actions={[
          { label: `Report ${target.name}`, icon: 'flag-outline', destructive: true, onPress: () => setReporting(true) },
          { label: `Block ${target.name}`, icon: 'ban-outline', destructive: true, onPress: confirmBlock },
        ]}
      />
      <ReportSheet
        visible={reporting}
        name={target.name}
        busy={safety.isPending}
        error={safety.error ? friendlyError(safety.error) : null}
        onClose={() => setReporting(false)}
        onSubmit={(reason) =>
          safety.mutate(
            { kind: 'report', targetId: target.id, reason },
            {
              onSuccess: () => {
                setReporting(false);
                Alert.alert('Thanks for telling us', `We’ll review your report. You won’t see ${target.name} again.`);
                onDone?.();
              },
            },
          )
        }
      />
    </>
  );
}
