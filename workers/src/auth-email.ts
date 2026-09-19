import type { Env } from './env';
import {
  ConsoleAdapter,
  ResendAdapter,
  type ConsoleMailLogger,
  type MailMessage,
  type SendMail,
} from './lib/mail';

export interface AuthMailRuntime {
  sendMail: SendMail;
  mailConfigured: boolean;
  verificationRequired: boolean;
}

type MailConfig = Pick<Env, 'RESEND_API_KEY' | 'MAIL_FROM' | 'MAIL_VERIFICATION_REQUIRED'>;

interface ResolveAuthMailOptions {
  fetch?: typeof fetch;
  log?: ConsoleMailLogger;
}

/** Resolves secrets once per request and keeps provider selection out of Better Auth config. */
export function resolveAuthMailRuntime(
  env: MailConfig,
  options: ResolveAuthMailOptions = {}
): AuthMailRuntime {
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.MAIL_FROM?.trim();
  const mailConfigured = Boolean(apiKey && from);
  const verificationRequired =
    mailConfigured && env.MAIL_VERIFICATION_REQUIRED?.trim().toLowerCase() === 'true';

  const adapter = mailConfigured
    ? new ResendAdapter({ apiKey: apiKey!, from: from!, fetch: options.fetch })
    : new ConsoleAdapter(options.log);

  return {
    sendMail: (message) => adapter.sendMail(message),
    mailConfigured,
    verificationRequired,
  };
}

export function sendVerificationMail(
  sendMail: SendMail,
  input: { to: string; url: string }
): Promise<void> {
  return sendMail(
    authMessage({
      to: input.to,
      subject: 'Verify your Pace Blueprint email',
      action: 'Verify email',
      url: input.url,
      ignore: 'If you did not create this account, you can ignore this email.',
    })
  );
}

export function sendPasswordResetMail(
  sendMail: SendMail,
  input: { to: string; url: string }
): Promise<void> {
  return sendMail(
    authMessage({
      to: input.to,
      subject: 'Reset your Pace Blueprint password',
      action: 'Reset password',
      url: input.url,
      ignore: 'If you did not request this reset, you can ignore this email.',
    })
  );
}

function authMessage(input: {
  to: string;
  subject: string;
  action: string;
  url: string;
  ignore: string;
}): MailMessage {
  const safeURL = escapeHtml(input.url);
  return {
    to: input.to,
    subject: input.subject,
    // The Better Auth supplied URL is the contract. Do not reconstruct its token or callback.
    text: `${input.action}:\n\n${input.url}\n\n${input.ignore}`,
    html: `<p><a href="${safeURL}">${input.action}</a></p><p>${input.ignore}</p>`,
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}
