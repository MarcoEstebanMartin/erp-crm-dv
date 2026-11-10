import prisma from '../../utils/prisma';
import {
  executeWithResilientRetry,
  ResilientAsyncQueue,
} from '../../utils/resilient-retry-queue.util';

export const externalRetryQueue = new ResilientAsyncQueue(2);

/**
 * Clasifica fallos transitorios de red, timeouts, rate-limit (429) o caídas de ARCA/AFIP y Meta Cloud API,
 * excluyendo errores definitivos de datos fiscales o credenciales (400/401/403/422).
 */
export function isTransientExternalError(err: unknown): boolean {
  if (!err) return false;
  if (err instanceof TypeError) return true; // Fallo de red nativo en fetch

  const anyErr = err as any;
  const status = Number(anyErr.statusCode || anyErr.status || 0);
  if (status === 408 || status === 429 || (status >= 500 && status <= 599)) {
    return true;
  }
  if (status >= 400 && status < 500) {
    return false;
  }

  const code = String(anyErr.code || '').toUpperCase();
  if (
    ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'UND_ERR_CONNECT_TIMEOUT'].includes(
      code,
    )
  ) {
    return true;
  }

  const name = String(anyErr.name || '');
  if (name === 'AbortError' || name === 'TimeoutError') {
    return true;
  }

  const msg = String(anyErr.message || err).toLowerCase();
  // Errores definitivos de negocio AFIP/ARCA no deben reintentarse a ciegas
  if (
    msg.includes('cuit') ||
    msg.includes('docnro') ||
    msg.includes('importe') ||
    msg.includes('alicuota') ||
    msg.includes('oauthException'.toLowerCase())
  ) {
    return false;
  }

  return (
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('aborted') ||
    msg.includes('socket hang up') ||
    msg.includes('service unavailable') ||
    msg.includes('bad gateway') ||
    msg.includes('gateway timeout') ||
    msg.includes('502') ||
    msg.includes('503') ||
    msg.includes('504') ||
    msg.includes('429') ||
    msg.includes('econnreset') ||
    msg.includes('fetch failed')
  );
}

export interface WhatsAppGraphDispatchInput {
  apiVersion: string;
  phoneNumberId: string;
  token: string;
  toWaId: string;
  text: string;
  mediaUrl?: string;
  mediaType?: string;
}

export async function dispatchWhatsAppCloudRequest(
  input: WhatsAppGraphDispatchInput,
): Promise<{ wamid: string | null }> {
  const url = `https://graph.facebook.com/${input.apiVersion}/${input.phoneNumberId}/messages`;
  const requestData: Record<string, unknown> = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: input.toWaId,
    type: input.mediaUrl ? input.mediaType || 'image' : 'text',
  };

  if (input.mediaUrl) {
    const mediaKey = input.mediaType === 'document' ? 'document' : 'image';
    requestData[mediaKey] = { link: input.mediaUrl, caption: input.text };
  } else {
    requestData.text = { body: input.text };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestData),
    signal: AbortSignal.timeout(15_000),
  });

  const responseData: any = await response.json().catch(() => ({}));
  if (!response.ok) {
    const httpErr: any = new Error(
      `Meta Cloud API HTTP ${response.status}: ${JSON.stringify(responseData)}`,
    );
    httpErr.statusCode = response.status;
    throw httpErr;
  }

  return { wamid: responseData?.messages?.[0]?.id || null };
}

export function enqueueWhatsAppOutboundRetry(
  crmMessageId: number,
  input: WhatsAppGraphDispatchInput,
): boolean {
  return externalRetryQueue.enqueue(
    {
      key: `wa-msg:${crmMessageId}`,
      label: `WhatsApp Outbound #${crmMessageId} -> ${input.toWaId}`,
      maxAttempts: 5,
      baseDelayMs: 5_000,
      maxDelayMs: 180_000,
      isRetryable: isTransientExternalError,
      run: async () => {
        const res = await dispatchWhatsAppCloudRequest(input);
        await prisma.crmMessage.update({
          where: { id: crmMessageId },
          data: {
            wamid: res.wamid || `wa_recovered_${crmMessageId}_${Date.now()}`,
            status: 'SENT',
          },
        });
      },
      onPermanentFailure: async () => {
        await prisma.crmMessage
          .update({
            where: { id: crmMessageId },
            data: {
              wamid: `failed_exhausted_${crmMessageId}_${Date.now()}`,
              status: 'FAILED',
            },
          })
          .catch(() => undefined);
      },
    },
    5_000,
  );
}

export function enqueueDeferredAfipCaeRetry(
  orderId: number,
  acquireCae: () => Promise<unknown>,
): boolean {
  return externalRetryQueue.enqueue(
    {
      key: `afip-cae:order:${orderId}`,
      label: `AFIP CAE diferido Pedido #${orderId}`,
      maxAttempts: 6,
      baseDelayMs: 20_000,
      maxDelayMs: 1_800_000,
      isRetryable: (err) => {
        const msg = String((err as any)?.message || err);
        if (msg.includes('ya posee CAE asignado')) return false;
        return isTransientExternalError(err);
      },
      run: async () => {
        await acquireCae();
      },
    },
    20_000,
  );
}

export { executeWithResilientRetry };
