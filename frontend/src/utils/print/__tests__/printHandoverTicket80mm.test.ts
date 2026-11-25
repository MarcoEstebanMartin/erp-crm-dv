import { describe, expect, it } from 'vitest';
import {
  buildArqueoTicketData,
  buildFieldSettlementTicketData,
  buildHandoverTicket80mmHtml,
  buildRouteClosureTicketData,
  formatTicketTimestampAr,
} from '../printHandoverTicket80mm';

describe('printHandoverTicket80mm', () => {
  it('formatea fecha y hora exacta con segundos en zona horaria Argentina', () => {
    // 2026-11-25T21:42:17Z -> 18:42:17 en America/Argentina/Buenos_Aires (UTC-3)
    const formatted = formatTicketTimestampAr('2026-11-25T21:42:17.000Z');
    expect(formatted).toBe('25/11/2026 18:42:17');
  });

  it('genera HTML térmico 80mm (área útil 72mm) con horario exacto y sin XSS', () => {
    const html = buildHandoverTicket80mmHtml({
      kind: 'FIELD_SETTLEMENT',
      voucherCode: 'REND-00042',
      timestampIso: '2026-11-25T21:42:17.000Z',
      deliveredBy: 'Gemini <Ventas>',
      deliveredByRole: 'Vendedor',
      receivedBy: 'Gemini',
      cashAmount: 150000,
      expectedCashAmount: 150000,
      checksAmount: 25000,
      checksCount: 1,
      transfersAmount: 10000,
      totalDelivered: 185000,
      difference: 0,
      receiptsCount: 2,
      receiptLines: [
        { code: 'RC-00010', clientName: 'Almacén Don Pepe', amount: 150000 },
        { code: 'RC-00011', clientName: 'Kiosco Sur', amount: 35000 },
      ],
    });

    expect(html).toContain('size: 80mm auto;');
    expect(html).toContain('width: 72mm;');
    expect(html).toContain('REND-00042');
    expect(html).toContain('25/11/2026 18:42:17');
    expect(html).toContain('Gemini &lt;Ventas&gt;');
    expect(html).not.toContain('<Ventas>');
    expect(html).not.toContain('CUIT:');
    expect(html).not.toContain('Firma quien entrega');
    expect(html).not.toContain('Firma quien recibe');
    expect(html).not.toContain('REIMPRESIÓN');
  });

  it('muestra REIMPRESIÓN y diferencia faltante cuando corresponde', () => {
    const data = buildFieldSettlementTicketData(
      {
        id: 18,
        collectorUserId: 7,
        collector: { id: 7, username: 'Gemini Ventas', role: 'VENDEDOR' },
        status: 'DISCREPANCY',
        expectedCash: 100000,
        declaredCash: 95000,
        cashDifference: -5000,
        expectedChecksCount: 0,
        expectedChecksAmount: 0,
        pendingTransfersAmount: 0,
        createdAt: '2026-11-25T15:00:00.000Z',
        approvedAt: '2026-11-25T20:10:05.000Z',
        receipts: [],
      },
      {
        declaredCash: 95000,
        receivedBy: 'Gemini',
        isReprint: true,
      },
    );

    const html = buildHandoverTicket80mmHtml(data);
    expect(html).toContain('REIMPRESIÓN');
    expect(html).toContain('FALTANTE: -$5.000');
    expect(html).toContain('25/11/2026 17:10:05');
  });

  it('arma ticket de cierre de ruta con chofer, acompañante, patente y medios de pago', () => {
    const data = buildRouteClosureTicketData(
      {
        id: 91,
        driverName: 'Gemini Reparto',
        companionName: 'Carlos',
        vehiclePlate: 'AB123CD',
        vehicleDescription: 'Master',
        orders: [{ id: 1 }, { id: 2 }, { id: 3 }],
      },
      {
        cashAmount: 220000,
        checksAmount: 40000,
        transfersAmount: 30000,
        creditAmount: 50000,
        notDeliveredCount: 1,
        notDeliveredAmount: 18000,
        receivedBy: 'Gemini',
        closedAt: '2026-11-25T22:05:33.000Z',
      },
    );

    const html = buildHandoverTicket80mmHtml(data);
    expect(html).toContain('CIERRE DE RUTA DE REPARTO');
    expect(html).toContain('VIAJE-00091');
    expect(html).toContain('Gemini Reparto + Carlos');
    expect(html).toContain('AB123CD · Master');
    expect(html).toContain('25/11/2026 19:05:33');
    expect(html).toContain('$290.000');
    expect(html).toContain('No entregados (1)');
  });

  it('arma ticket de arqueo clásico con totales y comprobantes', () => {
    const data = buildArqueoTicketData(
      {
        drawer: {
          id: 55,
          branch: 'VENDEDOR: GEMINI VENTAS',
          closedAt: '2026-11-25T20:00:09.000Z',
          realBalance: 80000,
          routeNote: 'Zona Norte',
        },
        difference: 0,
        verifiedReceipts: [
          { id: 1, receiptNumber: 'REC-00100', clientName: 'Mercado Central', amount: 80000, paymentMethod: 'CASH' },
        ],
      },
      { receivedBy: 'Gemini' },
    );

    const html = buildHandoverTicket80mmHtml(data);
    expect(html).toContain('ARQ-00055');
    expect(html).toContain('25/11/2026 17:00:09');
    expect(html).toContain('Zona Norte');
    expect(html).toContain('REC-00100');
  });
});
