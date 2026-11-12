// Maps Supabase/Postgres/network errors to short user-facing messages.
type MaybeError = { message?: string; code?: string; status?: number; name?: string } | null | undefined;

export function friendlyError(error: unknown): string {
  const e = error as MaybeError;
  const message = e?.message ?? '';
  const code = e?.code ?? '';

  if (/network request failed|failed to fetch|fetch failed/i.test(message)) {
    return 'You seem to be offline. Check your connection and try again.';
  }
  if (code === 'otp_expired' || /token has expired or is invalid/i.test(message)) {
    return 'That code is incorrect or has expired.';
  }
  if (code === 'over_sms_send_rate_limit' || /rate limit|too many/i.test(message)) {
    return 'Too many attempts. Please wait a minute and try again.';
  }
  if (code === 'sms_send_failed' || /error sending.*sms|sms.*fail/i.test(message)) {
    return 'We couldn’t send the code. Check the number and try again.';
  }
  if (code === 'phone_provider_disabled') {
    return 'Phone sign-in isn’t available right now.';
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
