import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Role, OrderStatus } from '@prisma/client';
import {
  isClientRequestIdUniqueConflict,
  normalizeClientRequestId,
} from '../../utils/client-request-id.util';

vi.mock('../../utils/prisma', () => ({
  __esModule: true,
  default: {
    persona: {
      findUnique: vi.fn(),
    },
    order: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import prisma from '../../utils/prisma';
import { OrderService } from '../order.service';

describe('Paso 1.2 — Idempotencia persistente en PostgreSQL (clientRequestId)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockPersona = {
    id: 100,
    name: 'Cliente Prueba',
    sellerId: 10,
    priceList: 'A',
    discount: 0,
    maxUnpaidInvoices: 0,
    creditLimit: 500000,
    outstandingBalance: 0,
  };

  it('normaliza y valida claves seguras de idempotencia', () => {
    expect(normalizeClientRequestId('  req-offline-12345  ')).toBe('req-offline-12345');
    expect(normalizeClientRequestId('corto')).toBeUndefined();
    expect(normalizeClientRequestId('invalido con espacios!')).toBeUndefined();
    expect(normalizeClientRequestId(undefined, 'backup-key-99999')).toBe('backup-key-99999');
  });

  it('detecta conflicto P2002 específicamente sobre clientRequestId', () => {
    expect(
      isClientRequestIdUniqueConflict({ code: 'P2002', meta: { target: ['clientRequestId'] } }),
    ).toBe(true);
    expect(
      isClientRequestIdUniqueConflict({ code: 'P2002', meta: { target: ['invoiceNumber'] } }),
    ).toBe(false);
    expect(isClientRequestIdUniqueConflict({ code: 'P2025' })).toBe(false);
  });

  it('devuelve el pedido existente sin abrir transacción si clientRequestId ya existe en PostgreSQL', async () => {
    const existingOrder = {
      id: 777,
      personaId: 100,
      sellerId: 10,
      clientRequestId: 'offline-order-uuid-0001',
      status: OrderStatus.PENDING,
      totalAmount: 15000,
      items: [],
    };
    (prisma.persona.findUnique as any).mockResolvedValue(mockPersona);
    (prisma.order.findUnique as any).mockResolvedValue(existingOrder);

    const result = await OrderService.createOrder({
      sellerId: 10,
      userRole: Role.VENDEDOR,
      personaId: 100,
      items: [{ productId: 50, quantity: 2 }],
      idempotencyKey: 'offline-order-uuid-0001',
    });

    expect(result).toEqual(existingOrder);
    expect(prisma.order.findUnique).toHaveBeenCalledWith({
      where: { clientRequestId: 'offline-order-uuid-0001' },
      include: { items: true },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('recupera el pedido original si dos requests concurrentes chocan con P2002 en clientRequestId', async () => {
    const concurrentOrder = {
      id: 888,
      personaId: 100,
      sellerId: 10,
      clientRequestId: 'race-order-uuid-0002',
      status: OrderStatus.PENDING,
      totalAmount: 25000,
      items: [],
    };
    (prisma.persona.findUnique as any).mockResolvedValue(mockPersona);
    (prisma.order.findUnique as any)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(concurrentOrder);
    (prisma.order.findFirst as any).mockResolvedValue(null);
    (prisma.$transaction as any).mockRejectedValue({
      code: 'P2002',
      meta: { target: ['clientRequestId'] },
    });

    const result = await OrderService.createOrder({
      sellerId: 10,
      userRole: Role.VENDEDOR,
      personaId: 100,
      items: [{ productId: 50, quantity: 3 }],
      idempotencyKey: 'race-order-uuid-0002',
    });

    expect(result).toEqual(concurrentOrder);
    expect(prisma.order.findUnique).toHaveBeenCalledTimes(2);
  });
});
