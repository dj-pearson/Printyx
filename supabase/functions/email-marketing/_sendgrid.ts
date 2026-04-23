// SendGrid REST wrapper — replaces @sendgrid/mail (Node-only) with fetch.
//
// API surface mirrors what the codebase uses:
//   - sendEmail()   — single recipient with optional custom args (used to
//                     thread email_send_id through webhooks)
//   - sendBulk()    — multi-recipient with chunking at 1000 per request
//                     (SendGrid hard limit for personalizations)
//
// Simulation mode: if SENDGRID_API_KEY is unset, returns a fake message-id
// and no-ops. Matches the behavior of server/services/email-service.ts when
// EMAIL_PROVIDER=simulation. Useful for dev + for tenants without SendGrid
// credentials configured.
//
// SendGrid API docs: https://docs.sendgrid.com/api-reference/mail-send/mail-send

export interface SendArgs {
  to: string | string[];
  from: string;
  fromName?: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  customArgs?: Record<string, string>;
}

export interface SendResult {
  messageId: string;
  simulated?: boolean;
  status?: number;
}

const SENDGRID_ENDPOINT = 'https://api.sendgrid.com/v3/mail/send';
const MAX_PERSONALIZATIONS_PER_REQUEST = 1000;

function apiKey(): string | null {
  return Deno.env.get('SENDGRID_API_KEY') ?? null;
}

export async function sendEmail(msg: SendArgs): Promise<SendResult> {
  const key = apiKey();
  if (!key) {
    return { messageId: `sim-${crypto.randomUUID()}`, simulated: true };
  }

  const toList = Array.isArray(msg.to) ? msg.to : [msg.to];

  const res = await fetch(SENDGRID_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [
        {
          to: toList.map((email) => ({ email })),
          ...(msg.customArgs ? { custom_args: msg.customArgs } : {}),
        },
      ],
      from: msg.fromName ? { email: msg.from, name: msg.fromName } : { email: msg.from },
      ...(msg.replyTo ? { reply_to: { email: msg.replyTo } } : {}),
      subject: msg.subject,
      content: [
        ...(msg.text ? [{ type: 'text/plain', value: msg.text }] : []),
        { type: 'text/html', value: msg.html },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new SendGridError(`SendGrid ${res.status}: ${body.slice(0, 500)}`, res.status, body);
  }
  return {
    messageId: res.headers.get('X-Message-Id') ?? 'unknown',
    status: res.status,
  };
}

export interface BulkPersonalization {
  to: string;
  name?: string;
  substitutions?: Record<string, string>;
  customArgs?: Record<string, string>;
}

// Single SendGrid call covering many recipients. If the batch exceeds
// MAX_PERSONALIZATIONS_PER_REQUEST, we chunk into multiple calls — each chunk
// is a separate SendGrid request.
export async function sendBulk(
  shared: Omit<SendArgs, 'to' | 'customArgs'>,
  recipients: BulkPersonalization[],
): Promise<{ messageIds: string[]; simulated: boolean; chunks: number }> {
  const key = apiKey();
  if (!key) {
    return {
      messageIds: recipients.map(() => `sim-${crypto.randomUUID()}`),
      simulated: true,
      chunks: 0,
    };
  }

  const messageIds: string[] = [];
  let chunks = 0;
  for (let i = 0; i < recipients.length; i += MAX_PERSONALIZATIONS_PER_REQUEST) {
    const chunk = recipients.slice(i, i + MAX_PERSONALIZATIONS_PER_REQUEST);
    chunks++;
    const res = await fetch(SENDGRID_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: chunk.map((r) => ({
          to: [{ email: r.to, ...(r.name ? { name: r.name } : {}) }],
          ...(r.substitutions ? { substitutions: r.substitutions } : {}),
          ...(r.customArgs ? { custom_args: r.customArgs } : {}),
        })),
        from: shared.fromName
          ? { email: shared.from, name: shared.fromName }
          : { email: shared.from },
        ...(shared.replyTo ? { reply_to: { email: shared.replyTo } } : {}),
        subject: shared.subject,
        content: [
          ...(shared.text ? [{ type: 'text/plain', value: shared.text }] : []),
          { type: 'text/html', value: shared.html },
        ],
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new SendGridError(
        `SendGrid bulk ${res.status} (chunk ${chunks}): ${body.slice(0, 500)}`,
        res.status,
        body,
      );
    }
    const id = res.headers.get('X-Message-Id') ?? 'unknown';
    // SendGrid returns one X-Message-Id per request; it applies to all
    // personalizations in that request. Echo it once per recipient so the
    // caller can pair them up.
    for (let j = 0; j < chunk.length; j++) messageIds.push(id);
  }
  return { messageIds, simulated: false, chunks };
}

export class SendGridError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: string,
  ) {
    super(message);
    this.name = 'SendGridError';
  }
}
