import { Redirect, router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { Wordmark } from '@/components/brand/Wordmark';
import { Screen, ScreenHeader } from '@/components/layout';
import {
  Button,
  Card,
  Chip,
  Divider,
  IconButton,
  Input,
  Photo,
  ProgressBar,
  Sheet,
  Text,
} from '@/components/ui';
import { colors, typography, type TypographyVariant } from '@/constants/theme';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="mb-8">
      <Text variant="overline" tone="muted" style={{ marginBottom: 12 }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

export default function DesignSystemScreen() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [progress, setProgress] = useState(0.3);

  if (!__DEV__) return <Redirect href="/" />;

  const toggle = (value: string) =>
    setSelected((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));

  return (
    <Screen
      header={
        <ScreenHeader
          title="Design system"
          subtitle="Development preview only"
          right={<IconButton icon="close" accessibilityLabel="Close" variant="surface" onPress={() => router.back()} />}
        />
      }
    >
      <Section title="Brand">
        <Wordmark size="lg" />
      </Section>

      <Section title="Colour">
        <View className="flex-row flex-wrap gap-3">
          {Object.entries(colors).map(([name, value]) => (
            <View key={name} className="w-[30%] min-w-[96px]">
              <View className="h-12 rounded-md border border-line" style={{ backgroundColor: value }} />
              <Text variant="caption" tone="muted" style={{ marginTop: 4 }}>
                {name}
              </Text>
            </View>
          ))}
        </View>
      </Section>

      <Section title="Typography">
        {(Object.keys(typography) as TypographyVariant[]).map((variant) => (
          <Text key={variant} variant={variant} style={{ marginBottom: 6 }}>
            {variant}
          </Text>
        ))}
      </Section>

      <Section title="Buttons">
        <View className="gap-3">
          <Button label="Primary" fullWidth />
          <Button label="Secondary" variant="secondary" fullWidth />
          <Button label="Outline" variant="outline" leftIcon="options-outline" fullWidth />
          <Button label="Ghost" variant="ghost" fullWidth />
          <Button label="Danger" variant="danger" fullWidth />
          <View className="flex-row gap-3">
            <Button label="Medium" size="md" />
            <Button label="Loading" size="md" loading />
            <Button label="Disabled" size="md" disabled />
          </View>
        </View>
      </Section>

      <Section title="Icon buttons">
        <View className="flex-row items-center gap-4">
          <IconButton icon="close" accessibilityLabel="Cross" variant="surface" size="lg" floating />
          <IconButton icon="heart" accessibilityLabel="Like" variant="brand" size="lg" floating />
          <IconButton icon="options-outline" accessibilityLabel="Filters" variant="surface" />
          <IconButton icon="ellipsis-horizontal" accessibilityLabel="More" size="sm" />
        </View>
      </Section>

      <Section title="Chips">
        <View className="flex-row flex-wrap gap-2">
          {['Option A', 'Option B', 'Option C'].map((option) => (
            <Chip key={option} label={option} selected={selected.includes(option)} onPress={() => toggle(option)} />
          ))}
          <Chip label="Static" icon="information-circle-outline" />
        </View>
      </Section>

      <Section title="Inputs">
        <View className="gap-4">
          <Input label="Label" placeholder="Placeholder" helper="Helper text" />
          <Input label="With error" placeholder="Placeholder" error="Error message" />
          <Input label="Multiline" placeholder="Placeholder" multiline />
        </View>
      </Section>

      <Section title="Card + photo">
        <Card padded={false}>
          <Photo source={require('../../assets/icon.png')} rounded="sm" aspectRatio={1} />
          <View className="p-5">
            <Text variant="heading">Card title</Text>
            <Text tone="muted" style={{ marginTop: 4 }}>
              Rounded card with a fixed-ratio photo.
            </Text>
          </View>
        </Card>
      </Section>

      <Section title="Progress">
        <ProgressBar progress={progress} />
        <View className="mt-3 flex-row gap-3">
          <Button label="−" size="md" variant="outline" onPress={() => setProgress((p) => Math.max(0, p - 0.1))} />
          <Button label="+" size="md" variant="outline" onPress={() => setProgress((p) => Math.min(1, p + 0.1))} />
        </View>
      </Section>

      <Section title="Sheet">
        <Button label="Open sheet" variant="secondary" onPress={() => setSheetOpen(true)} />
      </Section>

      <Divider />

      <Sheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Sheet title"
        footer={<Button label="Done" fullWidth onPress={() => setSheetOpen(false)} />}
      >
        <Text tone="muted">Bottom sheet content. Scrolls when taller than 90% of the screen.</Text>
      </Sheet>
    </Screen>
  );
}
