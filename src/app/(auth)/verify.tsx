import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { Text } from '@/components/ui';
import { colors, fonts } from '@/constants/theme';
import { sendOtp, verifyOtp } from '@/features/onboarding/api';
import { StepScaffold } from '@/features/onboarding/components/StepScaffold';
import { VERIFY_COPY } from '@/features/onboarding/copy';
import { AUTH_PROGRESS } from '@/features/onboarding/progress';
import { isValidOtp } from '@/features/onboarding/validation';
import { friendlyError } from '@/services/errors';
import { getSupabase } from '@/services/supabase';

const RESEND_SECONDS = 60;

function formatPhone(phone: string): string {
  const local = phone.replace(/^\+91/, '');
  return `+91 ${local.slice(0, 5)} ${local.slice(5)}`;
}

export default function VerifyScreen() {
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const submitting = useRef(false);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  const submit = async (value = code) => {
    if (submitting.current) return;
    if (!isValidOtp(value)) {
      setError('Enter the 6-digit code.');
      return;
    }
    submitting.current = true;
    setError(null);
    setLoading(true);
    try {
      // On success the auth listener updates the session and the router moves on.
      await verifyOtp(getSupabase(), phone, value);
    } catch (e) {
      setError(friendlyError(e));
      setCode('');
    } finally {
      setLoading(false);
      submitting.current = false;
    }
  };

  const resend = async () => {
    setError(null);
    setInfo(null);
    try {
      await sendOtp(getSupabase(), phone);
      setSecondsLeft(RESEND_SECONDS);
      setInfo('New code sent.');
    } catch (e) {
      setError(friendlyError(e));
    }
  };

  return (
    <StepScaffold
      progress={AUTH_PROGRESS}
      title={VERIFY_COPY.title}
      subtitle={`Sent to ${formatPhone(phone ?? '')}`}
      onBack={() => router.back()}
      onContinue={() => submit()}
      continueLabel="Verify"
      loading={loading}
      error={error}
    >
      <TextInput
        value={code}
        onChangeText={(t) => {
          const next = t.replace(/\D/g, '').slice(0, 6);
          setCode(next);
          if (next.length === 6) submit(next);
        }}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={6}
        autoFocus
        placeholder="••••••"
        placeholderTextColor={colors['line-strong']}
        accessibilityLabel="6-digit code"
        className="rounded-lg border border-line bg-surface"
        style={{
          height: 64,
          textAlign: 'center',
          letterSpacing: 12,
          fontFamily: fonts['sans-semibold'],
          fontSize: 28,
          color: colors.ink,
        }}
      />

      <View className="mt-5 flex-row items-center justify-between">
        <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={8}>
          <Text variant="label" tone="brand">
            Change number
          </Text>
        </Pressable>
        {secondsLeft > 0 ? (
          <Text variant="label" tone="subtle">
            Resend in {secondsLeft}s
          </Text>
        ) : (
          <Pressable onPress={resend} accessibilityRole="button" hitSlop={8}>
            <Text variant="label" tone="brand">
              Resend code
            </Text>
          </Pressable>
        )}
      </View>
      {info ? (
        <Text variant="caption" tone="muted" style={{ marginTop: 8 }}>
          {info}
        </Text>
      ) : null}
    </StepScaffold>
  );
}
