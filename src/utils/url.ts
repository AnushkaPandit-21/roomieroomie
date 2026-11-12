// Reads query and fragment parameters from a URL. Written by hand because React Native's
// URLSearchParams is incomplete; OAuth tokens come back in the fragment (#access_token=…).
export function getUrlParams(url: string): Record<string, string> {
  const params: Record<string, string> = {};
  const query = url.includes('?') ? url.slice(url.indexOf('?') + 1).split('#')[0] : '';
  const fragment = url.includes('#') ? url.slice(url.indexOf('#') + 1) : '';

  for (const part of [query, fragment]) {
    for (const pair of part.split('&')) {
      if (!pair) continue;
      const [key, ...rest] = pair.split('=');
      params[decodeURIComponent(key)] = decodeURIComponent(rest.join('=').replace(/\+/g, ' '));
    }
  }
  return params;
}
