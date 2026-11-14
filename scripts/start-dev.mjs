// `npm run dev` — starts Expo for Expo Go with the dev server addressed by a hostname instead of a
// bare LAN IP. Supabase Auth rejects redirect URLs whose host is an IP address (exp://192.168.x.x:8081
// falls back to the Site URL), so Google sign-in can't return to Expo Go on a plain `expo start`.
// <ip>.nip.io is a public DNS name that resolves to <ip>, so the phone still connects over Wi-Fi.
// Extra arguments are passed through, e.g. `npm run dev -- -c`.
import { spawn } from 'node:child_process';
import os from 'node:os';

const VIRTUAL = /vethernet|wsl|virtualbox|vmware|docker|hyper-v|loopback|tailscale|zerotier/i;
const isPrivate = (ip) => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);

function lanAddress() {
  const candidates = Object.entries(os.networkInterfaces())
    .filter(([name]) => !VIRTUAL.test(name))
    .flatMap(([, addrs]) => addrs ?? [])
    .filter((a) => a.family === 'IPv4' && !a.internal && isPrivate(a.address))
    .map((a) => a.address);
  // Home Wi-Fi first, then other private ranges.
  return candidates.find((ip) => ip.startsWith('192.168.')) ?? candidates[0];
}

const ip = process.env.DEV_LAN_IP ?? lanAddress();
if (!ip) {
  console.error('Could not find your Wi-Fi IP address. Set DEV_LAN_IP=<your IP> and try again.');
  process.exit(1);
}

const hostname = `${ip}.nip.io`;
console.log(`Dev server hostname: ${hostname} (Google sign-in returns to exp://${hostname}:<port>/--/auth/callback)`);

const child = spawn('npx', ['expo', 'start', ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, REACT_NATIVE_PACKAGER_HOSTNAME: hostname },
});
child.on('exit', (code) => process.exit(code ?? 0));
