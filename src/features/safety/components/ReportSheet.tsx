import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Button, Input, OptionList, Sheet, Text } from '@/components/ui';

import { REPORT_REASONS, type ReportReason } from '../api';

type ReportSheetProps = {
  visible: boolean;
  name: string;
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (reason: string) => void;
};

// Pick a reason, add optional details. Reporting also removes the person from your matches and feed.
export function ReportSheet({ visible, name, busy, error, onClose, onSubmit }: ReportSheetProps) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');

  useEffect(() => {
    if (visible) {
      setReason(null);
      setDetails('');
    }
  }, [visible]);

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={`Report ${name}`}
      footer={
        <Button
          label="Send report"
          fullWidth
          disabled={!reason}
          loading={busy}
          onPress={() => reason && onSubmit(details.trim() ? `${reason}: ${details.trim()}` : reason)}
        />
      }
    >
      <View className="gap-4">
        <Text tone="muted">
          {name} won’t be told who reported them. You won’t see each other again, and our team reviews every report.
        </Text>
        <OptionList options={REPORT_REASONS.map((r) => ({ value: r, label: r }))} value={reason} onChange={setReason} />
        <Input
          label="Anything else? (optional)"
          value={details}
          onChangeText={setDetails}
          multiline
          maxLength={400}
          placeholder="Add details that help us review this"
        />
        {error ? (
          <Text variant="caption" tone="danger">
            {error}
          </Text>
        ) : null}
      </View>
    </Sheet>
  );
}
