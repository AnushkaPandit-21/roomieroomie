// Supabase Auth "Send SMS" hook: delivers phone-OTP codes through the provider chosen by SMS_PROVIDER.
//
// Secrets (supabase secrets set ...):
//   SEND_SMS_HOOK_SECRET   v1,whsec_...  (generated when enabling the hook in the dashboard)
//   SMS_PROVIDER           msg91 | twilio
//   MSG91_AUTH_KEY, MSG91_TEMPLATE_ID                     (msg91; template must be DLT-approved)
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
//   TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM_NUMBER     (twilio)
//
// Twilio can alternatively be configured natively in Supabase Auth with no hook at all.
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0';

type HookPayload = { user: { phone: string }; sms: { otp: string } };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const fail = (message: string, status = 500) => json({ error: { http_code: status, message } }, status);

function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing secret ${name}`);
  return value;
}

// Supabase stores phone numbers as digits with country code and no '+', e.g. 919876543210.
const digitsOnly = (phone: string) => phone.replace(/\D/g, '');

async function sendViaMsg91(phone: string, otp: string): Promise<void> {
  const url = new URL('https://control.msg91.com/api/v5/otp');
  url.searchParams.set('template_id', env('MSG91_TEMPLATE_ID'));
  url.searchParams.set('mobile', digitsOnly(phone));
  url.searchParams.set('otp', otp);

  const res = await fetch(url, {
    method: 'POST',
    headers: { authkey: env('MSG91_AUTH_KEY'), 'Content-Type': 'application/json', Accept: 'application/json' },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.type !== 'success') {
    throw new Error(`MSG91 rejected the request: ${body.message ?? res.status}`);
  }
}

async function sendViaTwilio(phone: string, otp: string): Promise<void> {
  const sid = env('TWILIO_ACCOUNT_SID');
  const form = new URLSearchParams({ To: `+${digitsOnly(phone)}`, Body: `Your RoomieRoomie code is ${otp}` });
  const service = Deno.env.get('TWILIO_MESSAGING_SERVICE_SID');
  if (service) form.set('MessagingServiceSid', service);
  else form.set('From', env('TWILIO_FROM_NUMBER'));

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${sid}:${env('TWILIO_AUTH_TOKEN')}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Twilio rejected the request: ${body.message ?? res.status}`);
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return fail('Method not allowed', 405);

  let payload: HookPayload;
  try {
    const secret = env('SEND_SMS_HOOK_SECRET').replace('v1,whsec_', '');
    payload = new Webhook(secret).verify(await req.text(), Object.fromEntries(req.headers)) as HookPayload;
  } catch {
    // Never reveal why verification failed.
    return fail('Unauthorized', 401);
  }

  try {
    const provider = (Deno.env.get('SMS_PROVIDER') ?? '').toLowerCase();
    if (provider === 'msg91') await sendViaMsg91(payload.user.phone, payload.sms.otp);
    else if (provider === 'twilio') await sendViaTwilio(payload.user.phone, payload.sms.otp);
    else return fail('SMS_PROVIDER must be "msg91" or "twilio"');
    return json({});
  } catch (error) {
    // The OTP itself is never logged.
    console.error('send-sms failed:', (error as Error).message);
    return fail('Failed to send SMS');
  }
});
