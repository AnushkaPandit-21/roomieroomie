// The Google sign-in callback is handled by the browser session in features/auth/google.ts.
// On Android the same URL also reaches the router; send it to "/" so the navigator's guards
// decide where to go instead of showing an unmatched route.
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    return path.includes('auth/callback') ? '/' : path;
  } catch {
    return '/';
  }
}
