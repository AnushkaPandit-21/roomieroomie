import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Input, Photo, Sheet, Text } from '@/components/ui';
import { LIMITS } from '@/features/onboarding/options';

import type { LikedItem } from '../types';

type LikeSheetProps = {
  item: LikedItem | null;
  name: string;
  photoUri?: string;
  onClose: () => void;
  onSend: (comment: string) => void;
};

// "Like with comment": shows what's being liked, with an optional comment.
export function LikeSheet({ item, name, photoUri, onClose, onSend }: LikeSheetProps) {
  const [comment, setComment] = useState('');

  useEffect(() => {
    if (item) setComment('');
  }, [item]);

  return (
    <Sheet
      visible={!!item}
      onClose={onClose}
      title={`Like ${name}`}
      footer={<Button label="Send like" leftIcon="heart" fullWidth onPress={() => onSend(comment)} />}
    >
      {item?.kind === 'photo' ? (
        <View className="w-1/2 self-center">
          <Photo source={photoUri ? { uri: photoUri } : undefined} rounded="lg" />
        </View>
      ) : null}
      {item?.kind === 'prompt' ? (
        <Card elevated={false}>
          <Text variant="label" tone="muted">
            {item.prompt.question}
          </Text>
          <Text variant="heading" style={{ marginTop: 6 }}>
            {item.prompt.answer}
          </Text>
        </Card>
      ) : null}
      <View className="mt-4">
        <Input
          label="Add a comment (optional)"
          value={comment}
          onChangeText={setComment}
          placeholder="Say something about this…"
          multiline
          maxLength={LIMITS.promptAnswer}
          helper={`${comment.length}/${LIMITS.promptAnswer}`}
        />
      </View>
    </Sheet>
  );
}
