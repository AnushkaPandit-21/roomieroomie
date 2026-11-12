import { router } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { Text } from '@/components/ui';
import { colors, fonts } from '@/constants/theme';
import { sendOtp } from '@/features/onboarding/api';
import { StepScaffold } from '@/features/onboarding/components/StepScaffold';
import { PHONE_COPY } from '@/features/onboarding/copy';
import { AUTH_PROGRESS } from '@/features/onboarding/progress';
import { normalizeIndianPhone } from '@/features/onboarding/validation';
import { friendlyError } from '@/services/errors';
import { getSupabase } from '@/services/supabase';

export default function PhoneScreen() {
  const [digits, setDigits] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const phone = normalizeIndianPhone(digits);
    if (!phone) {
      setError('Enter a valid 10-digit mobile number.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await sendOtp(getSupabase(), phone);
      router.push({ pathname: '/verify', params: { phone } });
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <StepScaffold
      progress={AUTH_PROGRESS}
      title={PHONE_COPY.title}
      subtitle={PHONE_COPY.subtitle}
      onContinue={submit}
      continueLabel="Send code"
      loading={loading}
      error={error}
    >
      <View className="flex-row items-center rounded-lg border border-line bg-surface">
        <View className="h-[56px] justify-center border-r border-line px-4">
          <Text variant="bodyStrong">+91</Text>
        </View>
        <TextInput
          value={digits}
          onChangeText={(t) => setDigits(t.replace(/\D/g, '').slice(0, 10))}
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
          placeholder="98765 43210"
          placeholderTextColor={colors['ink-subtle']}
          maxLength={10}
          autoFocus
          onSubmitEditing={submit}
          accessibilityLabel="Mobile number"
          style={{ flex: 1, height: 56, paddingHorizontal: 16, fontFamily: fonts.sans, fontSize: 18, color: colors.ink }}
        />
      </View>
      <Text variant="caption" tone="subtle" style={{ marginTop: 12 }}>
        Standard SMS rates may apply.
      </Text>
    </StepScaffold>
  );
}
