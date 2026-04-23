// Twilio REST client — replaces the Node-only `twilio` SDK with fetch.
//
// Env:
//   TWILIO_ACCOUNT_SID
//   TWILIO_AUTH_TOKEN
//   TWILIO_FROM_NUMBER  (E.164)
//
// If any of those are unset, sendSms() returns simulated=true and no HTTP
// call is made. Mirrors the simulation-mode pattern from _sendgrid.ts.
//
// AWS SNS fallback from the Express service is NOT ported (per PRD §4).

export async function sendSms(
  to: string,
  body: string,
): Promise<{
  messageId: string;
  simulated: boolean;
}> {
  const sid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const token = Deno.env.get('TWILIO_AUTH_TOKEN');
  const from = Deno.env.get('TWILIO_FROM_NUMBER');

  if (!sid || !token || !from) {
    return { messageId: `sim-${crypto.randomUUID()}`, simulated: true };
  }

  const auth = btoa(`${sid}:${token}`);
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Twilio ${res.status}: ${text.slice(0, 500)}`);
  }
  const data = await res.json().catch(() => ({}) as Record<string, unknown>);
  return {
    messageId: String((data as { sid?: string }).sid ?? 'unknown'),
    simulated: false,
  };
}
