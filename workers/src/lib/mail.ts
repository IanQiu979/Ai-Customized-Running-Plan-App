/** Provider-neutral transactional mail boundary. Auth code never depends on a vendor payload. */
export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export type SendMail = (message: MailMessage) => Promise<void>;

type Fetcher = typeof fetch;

export interface ResendAdapterOptions {
  apiKey: string;
  from: string;
  fetch?: Fetcher;
}

/** Minimal Resend HTTP adapter; it deliberately does not inspect or echo provider response bodies. */
export class ResendAdapter {
  private readonly fetcher: Fetcher;

  constructor(private readonly options: ResendAdapterOptions) {
    this.fetcher = options.fetch ?? fetch;
  }

  async sendMail(message: MailMessage): Promise<void> {
    const response = await this.fetcher('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.options.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: this.options.from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
    });

    if (!response.ok) {
      // Provider bodies can reflect addresses or message content. Status is enough to diagnose
      // configuration/rate-limit failures without putting those values into Worker logs.
      throw new Error(`Mail delivery failed (HTTP ${response.status}).`);
    }
  }
}

export type ConsoleMailLogger = (
  event: 'mail_skipped_unconfigured',
  details: { to: '[redacted]'; subject: string }
) => void;

/** Safe local fallback: records capability state, never the recipient, content, URL, or token. */
export class ConsoleAdapter {
  constructor(private readonly log: ConsoleMailLogger = console.info) {}

  async sendMail(message: MailMessage): Promise<void> {
    this.log('mail_skipped_unconfigured', {
      to: '[redacted]',
      subject: message.subject,
    });
  }
}
