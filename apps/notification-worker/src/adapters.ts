import nodemailer from 'nodemailer';
import { WorkError } from '@app/messaging';
import type { DeliveryContext } from './service.js';

export function createMailer(options: { host: string; port: number; from: string }) {
  const transport = nodemailer.createTransport({
    host: options.host,
    port: options.port,
    secure: false,
    ignoreTLS: true,
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 10000,
  });
  return {
    async send(context: DeliveryContext): Promise<void> {
      if (!context.key) throw new WorkError('KEY_MISSING', true);
      try {
        const result = await transport.sendMail({
          from: options.from,
          to: context.recipientEmail,
          messageId: `<license-${context.licenseId}@nova.local>`,
          subject: `Licencja Nova ${context.licenseId}`,
          text: `Twój klucz licencyjny:\n\n${context.key}\n\nIdentyfikator licencji: ${context.licenseId}`,
        });
        if (!result.accepted?.length) throw new WorkError('SMTP_REJECTED', true);
      } catch (error) {
        const code =
          typeof error === 'object' && error !== null && 'responseCode' in error
            ? Number(error.responseCode)
            : 0;
        throw new WorkError(code >= 500 ? 'SMTP_REJECTED' : 'SMTP_UNAVAILABLE', code >= 500);
      }
    },
    close() {
      transport.close();
    },
  };
}
export async function writeMetric(
  options: { url: string; token: string; org: string; bucket: string },
  context: DeliveryContext,
): Promise<void> {
  const url = new URL('/api/v2/write', options.url);
  url.search = new URLSearchParams({
    org: options.org,
    bucket: options.bucket,
    precision: 'ns',
  }).toString();
  const timestamp = BigInt(context.createdAt.getTime()) * 1_000_000n;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Token ${options.token}`,
      'content-type': 'text/plain; charset=utf-8',
    },
    body: `license_generated,license_id=${context.licenseId} job_id="${context.jobId}" ${timestamp}`,
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok)
    throw new WorkError(
      'METRICS_REJECTED',
      response.status >= 400 && response.status < 500 && response.status !== 429,
    );
}
