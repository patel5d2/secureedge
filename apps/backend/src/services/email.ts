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
    '[email:dev] message dropped to log (no SMTP configured)'
  );
};

let transport: Transport = consoleTransport;

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
