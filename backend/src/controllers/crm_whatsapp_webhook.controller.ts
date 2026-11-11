import { Request, Response } from 'express';
import crypto from 'crypto';
import { env } from '../config/env.config';
import { whatsAppService } from '../services/whatsapp.service';

export interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

/**
 * Valida la firma HMAC-SHA256 de Meta en tiempo constante sin lanzar RangeError
 * ante longitudes distintas. En producción falla cerrado si falta el secreto.
 */
export function verifyMetaWebhookSignature(
  rawPayload: Buffer | string,
  signatureHeader?: string,
  appSecret?: string,
  nodeEnv: string = env.NODE_ENV,
): { ok: true } | { ok: false; statusCode: number; message: string } {
  const cleanSecret = appSecret?.trim() || '';

  if (!cleanSecret) {
    if (nodeEnv === 'production') {
      return {
        ok: false,
        statusCode: 503,
        message: 'Webhook deshabilitado: WHATSAPP_APP_SECRET no configurado en producción.',
      };
    }
    return { ok: true };
  }

  if (!signatureHeader || typeof signatureHeader !== 'string') {
    return { ok: false, statusCode: 401, message: 'Firma X-Hub-Signature-256 no provista.' };
  }

  const hmac = crypto.createHmac('sha256', cleanSecret);
  const expectedSignature = 'sha256=' + hmac.update(rawPayload).digest('hex');

  const sigBuf = Buffer.from(signatureHeader.trim(), 'utf8');
  const expectedBuf = Buffer.from(expectedSignature, 'utf8');

  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return { ok: false, statusCode: 403, message: 'Firma de webhook inválida.' };
  }

  return { ok: true };
}

/**
 * Webhook de Meta: Verificación GET (Challenge)
 */
export async function verifyWebhook(req: Request, res: Response): Promise<void> {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const configuredToken = process.env.WHATSAPP_VERIFY_TOKEN?.trim();
  const verifyToken =
    configuredToken || (env.NODE_ENV === 'production' ? '' : 'dv_crm_secure_token');

  if (!verifyToken) {
    res.status(503).send('WHATSAPP_VERIFY_TOKEN no configurado en producción.');
    return;
  }

  if (mode === 'subscribe' && token === verifyToken) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
}

/**
 * Webhook de Meta: Recepción POST con verificación criptográfica sobre rawBody
 */
export async function handleWebhook(req: RawBodyRequest, res: Response): Promise<void> {
  try {
    const rawPayload = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}), 'utf8');
    const sigHeader = req.headers['x-hub-signature-256'] as string | undefined;
    const verification = verifyMetaWebhookSignature(
      rawPayload,
      sigHeader,
      process.env.WHATSAPP_APP_SECRET,
      env.NODE_ENV,
    );

    if (!verification.ok) {
      res.status(verification.statusCode).send(verification.message);
      return;
    }

    const body = req.body;
    if (body?.object === 'whatsapp_business_account') {
      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          const value = change.value;
          if (value && value.messages) {
            for (const msg of value.messages) {
              await whatsAppService.handleIncomingMessage(msg);
            }
          }
        }
      }
      res.status(200).send('EVENT_RECEIVED');
    } else {
      res.sendStatus(404);
    }
  } catch (error: any) {
    console.error('Error en Webhook Meta:', error);
    res.status(500).send('SERVER_ERROR');
  }
}
