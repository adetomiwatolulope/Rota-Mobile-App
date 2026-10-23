/**
 * providers/email/index.ts — Email provider interface. [S-3]
 * Services depend on this interface, never on a provider SDK.
 *
 * The locked provider is Postmark [L-1]. This interface exists so the provider
 * can be replaced later without touching services [L-6 principle].
 */
export type SendEmailInput = {
  to: string;
  subject: string;
  textBody: string;
  htmlBody?: string;
};

export type SendEmailResult =
  | { ok: true; providerMessageId: string }
  | { ok: false; reason: string };

export interface EmailProvider {
  send(input: SendEmailInput): Promise<SendEmailResult>;
}
