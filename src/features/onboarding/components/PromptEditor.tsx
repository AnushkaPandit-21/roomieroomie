import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Card, Icon, Input, OptionList, Sheet, Text } from '@/components/ui';

import { LIMITS, PROMPT_QUESTIONS } from '../options';
import type { PromptDraft } from '../types';

type PromptEditorProps = {
  prompts: PromptDraft[];
  onChange: (prompts: PromptDraft[]) => void;
};

export function PromptEditor({ prompts, onChange }: PromptEditorProps) {
  const [choosingFor, setChoosingFor] = useState<number | null>(null);

  const update = (index: number, patch: Partial<PromptDraft>) =>
    onChange(prompts.map((p, i) => (i === index ? { ...p, ...patch } : p)));

  const takenElsewhere = (index: number) => prompts.filter((_, i) => i !== index).map((p) => p.question);

  return (
    <View className="gap-4">
      {prompts.map((prompt, index) => (
        <Card key={index} elevated={false}>
          <Pressable
            onPress={() => setChoosingFor(index)}
            accessibilityRole="button"
            accessibilityLabel={prompt.question ? `Change prompt ${index + 1}` : `Choose prompt ${index + 1}`}
          >
            <View className="flex-row items-center justify-between">
              <Text variant={prompt.question ? 'bodyStrong' : 'body'} tone={prompt.question ? 'default' : 'muted'} style={{ flex: 1 }}>
                {prompt.question || `Choose prompt ${index + 1}`}
              </Text>
              <Icon name={prompt.question ? 'swap-horizontal' : 'add-circle-outline'} size={20} color="ink-muted" />
            </View>
          </Pressable>
          {prompt.question ? (
            <View className="mt-3">
              <Input
                value={prompt.answer}
                onChangeText={(answer) => update(index, { answer })}
                placeholder="Your answer"
                multiline
                maxLength={LIMITS.promptAnswer}
                accessibilityLabel={`Answer to: ${prompt.question}`}
                helper={`${prompt.answer.length}/${LIMITS.promptAnswer}`}
              />
            </View>
          ) : null}
        </Card>
      ))}

      <Sheet visible={choosingFor !== null} onClose={() => setChoosingFor(null)} title="Choose a prompt">
        {choosingFor !== null ? (
          <OptionList
            options={PROMPT_QUESTIONS.filter((q) => !takenElsewhere(choosingFor).includes(q)).map((q) => ({
              value: q,
              label: q,
            }))}
            value={prompts[choosingFor].question || null}
            onChange={(question) => {
              update(choosingFor, { question });
              setChoosingFor(null);
            }}
          />
        ) : null}
      </Sheet>
    </View>
  );
}
