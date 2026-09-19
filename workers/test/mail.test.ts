import { describe, expect, it, vi } from 'vitest';

import { ConsoleAdapter, ResendAdapter, type MailMessage } from '../src/lib/mail';
import { resolveAuthMailRuntime } from '../src/auth-email';

const MESSAGE: MailMessage = {
  to: 'runner@example.test',
  subject: 'Reset your password',
  text: 'Open https://example.test/reset?token=top-secret-token',
  html: '<a href="https://example.test/reset?token=top-secret-token">Reset</a>',
};

describe('ResendAdapter', () => {
  it('posts the provider-neutral message to Resend with server credentials', async () => {
    let request: Request | undefined;
    const fetcher: typeof fetch = async (input, init) => {
      request = new Request(input, init);
      return new Response(JSON.stringify({ id: 'email-1' }), { status: 200 });
    };

    await new ResendAdapter({
      apiKey: 'test-api-key',
      from: 'Pace Blueprint <mail@example.test>',
      fetch: fetcher,
    }).sendMail(MESSAGE);

    expect(request?.url).toBe('https://api.resend.com/emails');
    expect(request?.method).toBe('POST');
    expect(request?.headers.get('authorization')).toBe('Bearer test-api-key');
    expect(request && (await request.json())).toEqual({
      from: 'Pace Blueprint <mail@example.test>',
      to: ['runner@example.test'],
      subject: 'Reset your password',
      text: MESSAGE.text,
      html: MESSAGE.html,
    });
  });

  it('throws a sanitized error for a rejected Resend request', async () => {
    const adapter = new ResendAdapter({
      apiKey: 'test-api-key',
      from: 'mail@example.test',
      fetch: async () =>
        new Response('provider leaked token=top-secret-token and the entire body', {
          status: 422,
        }),
    });

    const error = await adapter.sendMail(MESSAGE).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain('422');
    expect((error as Error).message).not.toContain('top-secret-token');
    expect((error as Error).message).not.toContain(MESSAGE.text);
    expect((error as Error).message).not.toContain(MESSAGE.html);
  });
});

describe('ConsoleAdapter', () => {
  it('logs only a fixed event, a fully redacted recipient, and the subject', async () => {
    const log = vi.fn();
    await new ConsoleAdapter(log).sendMail(MESSAGE);

    expect(log).toHaveBeenCalledWith('mail_skipped_unconfigured', {
      to: '[redacted]',
      subject: 'Reset your password',
    });
    const serialized = JSON.stringify(log.mock.calls);
    expect(serialized).not.toContain('runner');
    expect(serialized).not.toContain('example.test');
    expect(serialized).not.toContain('top-secret-token');
    expect(serialized).not.toContain('https://');
    expect(serialized).not.toContain('<a');
  });
});

describe('resolveAuthMailRuntime', () => {
  it.each([
    {
      name: 'nothing configured',
      key: undefined,
      from: undefined,
      flag: undefined,
      configured: false,
      required: false,
    },
    {
      name: 'only the key configured',
      key: 'key',
      from: '  ',
      flag: 'true',
      configured: false,
      required: false,
    },
    {
      name: 'only the sender configured',
      key: '\n',
      from: 'mail@example.test',
      flag: 'true',
      configured: false,
      required: false,
    },
    {
      name: 'delivery configured but verification left off',
      key: ' key\n',
      from: ' Pace <mail@example.test> ',
      flag: ' false ',
      configured: true,
      required: false,
    },
    {
      name: 'delivery configured and verification enabled case-insensitively',
      key: ' key\n',
      from: ' Pace <mail@example.test> ',
      flag: ' TRUE\n',
      configured: true,
      required: true,
    },
  ])('$name', ({ key, from, flag, configured, required }) => {
    const runtime = resolveAuthMailRuntime(
      { RESEND_API_KEY: key, MAIL_FROM: from, MAIL_VERIFICATION_REQUIRED: flag },
      { fetch: vi.fn() as unknown as typeof fetch, log: vi.fn() }
    );

    expect(runtime.mailConfigured).toBe(configured);
    expect(runtime.verificationRequired).toBe(required);
  });
});
