// Maps Supabase/Postgres/network errors to short user-facing messages.
type MaybeError = { message?: string; code?: string; status?: number; name?: string } | null | undefined;

export function friendlyError(error: unknown): string {
  const e = error as MaybeError;
  const message = e?.message ?? '';
  const code = e?.code ?? '';

  if (/network request failed|failed to fetch|fetch failed/i.test(message)) {
    return 'You seem to be offline. Check your connection and try again.';
  }
  if (/message_rate_limit_reached/.test(message)) return 'You’re sending messages too fast. Wait a minute and try again.';
  if (/message_daily_limit_reached/.test(message)) return 'You’ve reached today’s message limit. You can send more tomorrow.';
  if (/report_daily_limit_reached/.test(message)) return 'You’ve sent a lot of reports today. Please try again tomorrow, or block this person.';
  // Dev-only setup hint from signInWithGoogle; shown as is.
  if (message.includes('npm run dev')) return message;
  if (/rate limit|too many/i.test(message)) {
    return 'Too many attempts. Please wait a minute and try again.';
  }
  if (code === 'anonymous_provider_disabled' || /anonymous sign-ins are disabled/i.test(message)) {
    return 'Turn on “Allow anonymous sign-ins” in Supabase → Authentication → Sign In / Providers.';
  }
  if (code === 'provider_disabled' || /provider is not enabled|unsupported provider/i.test(message)) {
    return 'Google sign-in isn’t available right now.';
  }
  if (/redirect/i.test(message) && /not allowed|invalid/i.test(message)) {
    return 'Sign-in isn’t set up for this app yet (redirect URL not allowed).';
  }
  if (code === '23514' || code === 'check_violation') {
    if (/18|dob/i.test(message)) return 'You must be 18 or older to use RoomieRoomie.';
    if (/at most 6 photos/i.test(message)) return 'You can add up to 6 photos.';
    return 'Some of your answers aren’t valid. Please check and try again.';
  }
  if (code === '42501' || /row-level security|permission denied/i.test(message)) {
    return 'You’re not allowed to do that. Try signing in again.';
  }
  if (/payload too large|exceeded the maximum allowed size/i.test(message)) {
    return 'That photo is too large. Try a different one.';
  }
  return 'Something went wrong. Please try again.';
}
