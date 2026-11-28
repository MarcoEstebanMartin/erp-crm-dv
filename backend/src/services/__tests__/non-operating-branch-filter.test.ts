import { describe, it, expect } from 'vitest';
import {
  buildOperatingCreditNoteWhere,
  buildOperatingOrderWhere,
  isNonOperatingInvoiceNumber,
} from '../admin/admin-report.helpers';
import { parseInvoiceNumber } from '../billing/iva-afip-format.helper';

describe('Exclusión de Sucursal 0006 (Inmobiliaria / Alquileres) en reportes comerciales', () => {
  it('identifica correctamente comprobantes del Punto de Venta 0006 (4 y 5 dígitos)', () => {
    expect(isNonOperatingInvoiceNumber('00006-00000019')).toBe(true);
    expect(isNonOperatingInvoiceNumber('0006-00000019')).toBe(true);
    expect(isNonOperatingInvoiceNumber('FA-0006-00000019')).toBe(false);
    expect(isNonOperatingInvoiceNumber('00005-00012345')).toBe(false);
    expect(isNonOperatingInvoiceNumber('0005-00012345')).toBe(false);
    expect(isNonOperatingInvoiceNumber('INT-00006')).toBe(false);
    expect(isNonOperatingInvoiceNumber(null)).toBe(false);
    expect(isNonOperatingInvoiceNumber(undefined)).toBe(false);
  });

  it('construye un filtro Prisma seguro que excluye PV 0006 pero preserva comprobantes internos con invoiceNumber null', () => {
    const orderWhere = buildOperatingOrderWhere();
    expect(orderWhere).toEqual({
      OR: [
        { invoiceNumber: null },
        {
          AND: [
            { NOT: { invoiceNumber: { startsWith: '00006-' } } },
            { NOT: { invoiceNumber: { startsWith: '0006-' } } },
          ],
        },
      ],
    });

    const cnWhere = buildOperatingCreditNoteWhere();
    expect(cnWhere).toEqual({
      AND: [
        {
          OR: [
            { creditNoteNumber: null },
            {
              AND: [
                { NOT: { creditNoteNumber: { startsWith: '00006-' } } },
                { NOT: { creditNoteNumber: { startsWith: '0006-' } } },
              ],
            },
          ],
        },
        {
          OR: [{ orderId: null }, { order: orderWhere }],
        },
      ],
    });
  });

  it('mantiene intacto el parseo fiscal del Punto de Venta 0006 para el TXT de AFIP', () => {
    expect(parseInvoiceNumber('00006-00000019')).toEqual({
      ptoVenta: '00006',
      cbte: '00000000000000000019',
    });
    expect(parseInvoiceNumber('0006-00000019')).toEqual({
      ptoVenta: '00006',
      cbte: '00000000000000000019',
    });
  });
});
