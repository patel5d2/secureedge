import { config } from '../config';
import { logger } from '../lib/logger';

export interface OutboundEmail {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

type Transport = (msg: OutboundEmail) => Promise<void>;

const consoleTransport: Transport = async (msg) => {
  logger.info(
    { to: msg.to, subject: msg.subject, body: msg.text },
    '[email:dev] message dropped to log (no transport configured)'
  );
};

/**
 * Resend (https://resend.com) HTTP transport. Picked because their free tier
 * (3k/mo, 100/day) is enough for a small ZTNA tenant and the API is one POST.
 *
 * Required env: RESEND_API_KEY, EMAIL_FROM (e.g. 'SecureEdge <noreply@example.com>').
 */
function resendTransport(apiKey: string, from: string): Transport {
  return async (msg) => {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: msg.to,
        subject: msg.subject,
        text: msg.text,
        ...(msg.html ? { html: msg.html } : {}),
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`resend send failed: ${res.status} ${body}`);
    }
  };
}

function pickDefaultTransport(): Transport {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (apiKey && from) {
    logger.info({ from }, 'email transport: resend');
    return resendTransport(apiKey, from);
  }
  if (config.NODE_ENV === 'production') {
    // Loud warning — sign-up will create accounts the user can never verify.
    logger.error(
      'no email transport configured in production: set RESEND_API_KEY + EMAIL_FROM (or call setEmailTransport)'
    );
  }
  return consoleTransport;
}

let transport: Transport = pickDefaultTransport();

export function setEmailTransport(t: Transport): void {
  transport = t;
}

export async function sendEmail(msg: OutboundEmail): Promise<void> {
  await transport(msg);
}

function appUrl(): string {
  return config.CORS_ORIGIN.replace(/\/$/, '');
}

export async function sendVerificationEmail(
  to: string,
  fullName: string,
  token: string
): Promise<void> {
  const link = `${appUrl()}/verify?token=${encodeURIComponent(token)}`;
  await sendEmail({
    to,
    subject: 'Verify your SecureEdge email',
    text:
      `Hi ${fullName},\n\n` +
      `Confirm your SecureEdge email by opening this link within 10 minutes:\n${link}\n\n` +
      `If you didn't create this account, you can ignore this message.`,
  });
}

export async function sendInviteEmail(
  to: string,
  fullName: string,
  token: string
): Promise<void> {
  const link = `${appUrl()}/invite?token=${encodeURIComponent(token)}`;
  await sendEmail({
    to,
    subject: 'You have been invited to SecureEdge',
    text:
      `Hi ${fullName},\n\n` +
      `An administrator invited you to SecureEdge. Set your password and activate your account here (link valid for 24 hours):\n${link}`,
  });
}
