import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BillingType,
  LedgerEntryType,
  LedgerSourceType,
  OrderStatus,
  PaymentMethod,
  TransactionType,
} from '@prisma/client';
import prisma from '../../utils/prisma';
import * as auditModule from '../../utils/audit';
import { deliveryRouteService } from '../logistics/delivery-route.service';
import { routeSettlementService } from '../logistics/route-settlement.service';
import { routeCustodyGpsService } from '../logistics/route-custody-gps.service';
import { vehicleMaintenanceService } from '../fleet/vehicle-maintenance.service';

describe('Logística y Flota Services (Decimal.js, AccountLedger y Sanitización)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(auditModule, 'logAudit').mockResolvedValue(undefined as any);
  });

  it('settleDeliveryRoute registra DEBIT (ORDER_INVOICE) + REC-XXXXX + CREDIT (COLLECTION_RECEIPT) en AccountLedger con pesos enteros', async () => {
    vi.spyOn(prisma.deliveryRoute, 'findUnique').mockResolvedValue({
      id: 12,
      driverName: 'Matias',
      status: 'IN_TRANSIT',
      orders: [
        {
          id: 45,
          personaId: 9,
          status: OrderStatus.PREPARED,
          billingType: BillingType.INTERNAL,
          totalAmount: '18500.50',
          invoiceNumber: null,
          persona: { id: 9, name: 'Autoservicio El Sol', cuit: null },
        },
        {
          id: 46,
          personaId: 10,
          status: OrderStatus.PREPARED,
          billingType: BillingType.INTERNAL,
          totalAmount: '9200.00',
          invoiceNumber: null,
          persona: { id: 10, name: 'Despensa Belgrano', cuit: null },
        },
      ],
    } as any);

    const ledgerEntries: any[] = [];
    const mockTx: any = {
      order: { update: vi.fn().mockResolvedValue({}) },
      user: { findFirst: vi.fn().mockResolvedValue({ id: 5, username: 'matias' }) },
      cashDrawer: { findFirst: vi.fn().mockResolvedValue({ id: 33 }) },
      bankAccount: { findFirst: vi.fn().mockResolvedValue({ id: 1 }) },
      persona: {
        update: vi.fn().mockResolvedValue({ id: 9, outstandingBalance: '0.00' }),
      },
      accountLedger: {
        create: vi.fn().mockImplementation(({ data }) => {
          ledgerEntries.push(data);
          return Promise.resolve({ id: ledgerEntries.length, ...data });
        }),
      },
      transaction: {
        create: vi.fn().mockImplementation(({ data }) =>
          Promise.resolve({ id: 701, movementId: 88, ...data }),
        ),
        update: vi.fn().mockResolvedValue({}),
      },
      deliveryRoute: { update: vi.fn().mockResolvedValue({ id: 12, status: 'COMPLETED' }) },
    };

    vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(mockTx));

    await routeSettlementService.settleDeliveryRoute({
      routeId: 12,
      userId: 1,
      settlements: [
        { orderId: 45, paymentMethod: 'CASH' },
        { orderId: 46, paymentMethod: 'CREDITO' },
      ],
      cashDeclared: 18501,
    });

    // Pedido #45: 18500.50 -> 18501 (ROUND_HALF_UP), genera DEBIT + cobro CASH con REC-00088 + CREDIT
    // Pedido #46: 9200 -> 9200 en CREDITO, genera solo DEBIT (sin transacción de cobro)
    expect(mockTx.transaction.create).toHaveBeenCalledTimes(1);
    expect(mockTx.transaction.update).toHaveBeenCalledWith({
      where: { id: 701 },
      data: { receiptNumber: 'REC-00088' },
    });
    expect(ledgerEntries).toHaveLength(3);
    expect(ledgerEntries[0]).toMatchObject({
      personaId: 9,
      entryType: LedgerEntryType.DEBIT,
      sourceType: LedgerSourceType.ORDER_INVOICE,
      amount: 18501,
      orderId: 45,
    });
    expect(ledgerEntries[1]).toMatchObject({
      personaId: 9,
      entryType: LedgerEntryType.CREDIT,
      sourceType: LedgerSourceType.COLLECTION_RECEIPT,
      amount: 18501,
      orderId: 45,
      transactionId: 701,
    });
    expect(ledgerEntries[2]).toMatchObject({
      personaId: 10,
      entryType: LedgerEntryType.DEBIT,
      sourceType: LedgerSourceType.ORDER_INVOICE,
      amount: 9200,
      orderId: 46,
    });
  });

  it('getDeliveryRoutes aplica selección segura en Persona omitiendo webPin', async () => {
    const findManySpy = vi.spyOn(prisma.deliveryRoute, 'findMany').mockResolvedValue([] as any);

    await deliveryRouteService.getDeliveryRoutes({ status: 'PENDING' });

    const callArg = findManySpy.mock.calls[0][0] as any;
    const personaSelect = callArg.include.orders.include.persona.select;
    expect(personaSelect).toBeDefined();
    expect(personaSelect.id).toBe(true);
    expect(personaSelect.name).toBe(true);
    expect(personaSelect.webPin).toBeUndefined();
  });

  it('transferRouteCustody suma bultos con precisión entera y recordRouteGpsPing valida coordenadas', async () => {
    vi.spyOn(prisma.deliveryRoute, 'findUnique').mockResolvedValue({
      id: 4,
      orders: [{ id: 1, bultosCount: 3 }, { id: 2, bultosCount: 0 }, { id: 3, bultosCount: 5 }],
    } as any);
    const updateSpy = vi
      .spyOn(prisma.deliveryRoute, 'update')
      .mockResolvedValue({ id: 4, totalBultos: 9, status: 'IN_TRANSIT' } as any);

    await routeCustodyGpsService.transferRouteCustody(4, 'Carga conforme', 1);

    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 4 },
        data: expect.objectContaining({
          totalBultos: 9,
          custodyStatus: 'LOADED_IN_TRANSIT',
          status: 'IN_TRANSIT',
        }),
      }),
    );

    await expect(
      routeCustodyGpsService.recordRouteGpsPing({
        routeId: 4,
        latitude: -95,
        longitude: -63.02,
      }),
    ).rejects.toThrow('Coordenadas GPS inválidas.');
  });

  it('createMaintenance redondea con Decimal.js (ROUND_HALF_UP), genera OUTCOME verificado y actualiza odómetro', async () => {
    vi.spyOn(prisma.vehicle, 'findUnique').mockResolvedValue({
      id: 3,
      plate: 'AE 178 EC',
      currentOdometer: 120000,
    } as any);

    const mockTx: any = {
      transaction: {
        create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 310, ...data })),
      },
      vehicleMaintenance: {
        create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 55, ...data })),
      },
      vehicle: {
        update: vi.fn().mockResolvedValue({}),
      },
    };

    vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(mockTx));

    const res = await vehicleMaintenanceService.createMaintenance({
      userId: 1,
      vehicleId: 3,
      type: 'SERVICE',
      description: 'Cambio de aceite y filtros',
      cost: '145000.50',
      odometer: 125400,
      affectFinance: true,
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      bankAccountId: 2,
    });

    expect(res.transactionId).toBe(310);
    expect(mockTx.transaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: TransactionType.OUTCOME,
        amount: 145001,
        verified: true,
        bankAccountId: 2,
      }),
    });
    expect(mockTx.vehicle.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { currentOdometer: 125400 },
    });
  });
});
