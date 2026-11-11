import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import prisma from '../../utils/prisma';
import { env } from '../../config/env.config';
import { roundToTwoDecimals } from '../../core/money';

const BCRYPT_ROUNDS = 10;

export function isHashedPin(storedPin: string): boolean {
  return storedPin.startsWith('$2a$') || storedPin.startsWith('$2b$') || storedPin.startsWith('$2y$');
}

/**
 * Verifica un PIN contra el valor guardado (soportando hash bcrypt o PIN legado en texto plano).
 * Si coincide con un PIN legado en texto plano, indica `needsUpgrade = true` para encriptarlo al vuelo.
 */
export async function verifyClientPin(
  providedPin: string,
  storedPin: string,
): Promise<{ valid: boolean; needsUpgrade: boolean }> {
  if (isHashedPin(storedPin)) {
    const valid = await bcrypt.compare(providedPin, storedPin);
    return { valid, needsUpgrade: false };
  }
  const valid = providedPin === storedPin;
  return { valid, needsUpgrade: valid };
}

export async function hashClientPin(plainPin: string): Promise<string> {
  return bcrypt.hash(plainPin, BCRYPT_ROUNDS);
}

/**
 * Genera un token JWT de inicio de sesión mágico para enlaces de WhatsApp (usado por CRM).
 */
export function generateMagicToken(personaId: number, draftId?: number): string {
  return jwt.sign(
    { personaId, draftId: draftId || null, type: 'magic_login' },
    env.JWT_SECRET,
    { expiresIn: '7d' },
  );
}

export function signStoreClientSessionToken(client: {
  id: number;
  name: string;
  cuit: string | null;
  priceList: string | null;
}): string {
  return jwt.sign(
    {
      personaId: client.id,
      name: client.name,
      cuit: client.cuit,
      priceList: client.priceList || 'A',
      role: 'CLIENTE',
    },
    env.JWT_SECRET,
    { expiresIn: '30d' },
  );
}

/**
 * Obtiene o crea de forma segura el usuario virtual de preventa web ("tienda_online").
 */
export async function getTiendaOnlineUser() {
  let user = await prisma.user.findFirst({
    where: { username: 'tienda_online' },
  });

  if (!user) {
    const unusableHash = await bcrypt.hash(`tienda-virtual-${Date.now()}-${env.JWT_SECRET}`, BCRYPT_ROUNDS);
    user = await prisma.user.create({
      data: {
        username: 'tienda_online',
        passwordHash: unusableHash,
        role: Role.VENDEDOR,
        isActive: true,
      },
    });
  }

  return user;
}

export class StoreAuthService {
  static async authenticateClient(input: {
    cuitOrCode?: string;
    search?: string;
    pin?: string;
    clientId?: number;
  }) {
    const queryTerm = (input.cuitOrCode || input.search || '').trim();
    const providedPin = (input.pin || '').trim();

    if (!queryTerm && !input.clientId) {
      return { httpStatus: 200, payload: { status: 'success', data: { clients: [] } } };
    }

    const clientSelect = {
      id: true,
      name: true,
      cuit: true,
      address: true,
      city: true,
      priceList: true,
      discount: true,
      outstandingBalance: true,
      creditLimit: true,
      paymentTermDays: true,
      webPin: true,
      isActive: true,
      isClient: true,
    };

    let client: any = null;

    if (input.clientId) {
      const found = await prisma.persona.findUnique({
        where: { id: Number(input.clientId) },
        select: clientSelect,
      });
      if (found && found.isActive && found.isClient) {
        client = found;
      }
    } else {
      const cleanDigits = queryTerm.replace(/\D/g, '');
      if (cleanDigits.length < 7 || cleanDigits.length > 11) {
        return {
          httpStatus: 400,
          payload: {
            status: 'error',
            message: 'Ingresá tu CUIT o DNI registrado (sin nombres parciales) para acceder.',
          },
        };
      }

      const candidates = await prisma.persona.findMany({
        where: {
          isClient: true,
          isActive: true,
          cuit: { not: null },
        },
        select: clientSelect,
      });

      client =
        candidates.find((c) => (c.cuit || '').replace(/\D/g, '') === cleanDigits) || null;

      if (!client) {
        return {
          httpStatus: 404,
          payload: {
            status: 'error',
            message: 'No se encontró ningún cliente activo con el CUIT/DNI ingresado.',
          },
        };
      }
    }

    if (!client) {
      return { httpStatus: 404, payload: { status: 'error', message: 'Cliente no encontrado.' } };
    }

    if (client.webPin) {
      if (!providedPin) {
        return {
          httpStatus: 200,
          payload: {
            status: 'requires_pin',
            message: 'Ingresá tu PIN secreto para ingresar a la tienda.',
            hasPin: true,
            client: { id: client.id, name: client.name, cuit: client.cuit },
          },
        };
      }

      const pinCheck = await verifyClientPin(providedPin, client.webPin);
      if (!pinCheck.valid) {
        return {
          httpStatus: 401,
          payload: {
            status: 'error',
            message: '🔒 PIN de acceso incorrecto. Verificá tu clave o consultá con administración.',
          },
        };
      }

      if (pinCheck.needsUpgrade) {
        const upgradedHash = await hashClientPin(providedPin);
        await prisma.persona.update({
          where: { id: client.id },
          data: { webPin: upgradedHash },
        });
      }
    } else {
      // Bloqueo anti-secuestro de cuenta: prohibido fijar el primer PIN sin verificación previa
      return {
        httpStatus: 403,
        payload: {
          status: 'error',
          code: 'PIN_NOT_INITIALIZED',
          message:
            'Tu cuenta aún no tiene PIN habilitado. Ingresá desde el enlace enviado por WhatsApp o solicitá tu PIN inicial a administración.',
        },
      };
    }

    const token = signStoreClientSessionToken(client);

    return {
      httpStatus: 200,
      payload: {
        status: 'success',
        data: {
          token,
          client: {
            id: client.id,
            name: client.name,
            cuit: client.cuit,
            address: client.address,
            city: client.city,
            priceList: client.priceList || 'A',
            discount: roundToTwoDecimals(client.discount || 0).toNumber(),
            outstandingBalance: roundToTwoDecimals(client.outstandingBalance || 0).toNumber(),
            creditLimit: roundToTwoDecimals(client.creditLimit || 0).toNumber(),
            paymentTermDays: client.paymentTermDays || 30,
          },
        },
      },
    };
  }
}
