import { describe, expect, it } from 'vitest';
import {
  computeAdaptiveFulfillmentColumns,
  formatBigIntARS,
  formatOrderRelativeAge,
  resolveOrderFiscalChannelBadge,
  resolveOrderOriginLabel,
  sumOrdersTotalInt,
} from '../fulfillmentCardMeta.helper';
import {
  accumulateAfipMetricsBigInt,
  formatCentsARS,
  resolveAfipPeriodLastDay,
} from '../afipSubdiarioPdf';

describe('Paso 3: Minimalismo Operativo, Armado de Pedidos y Métricas AFIP', () => {
  describe('formatOrderRelativeAge', () => {
    const baseNow = Date.parse('2026-11-14T21:00:00.000Z'); // 18:00 AR

    it('formatea recién, minutos, horas y fecha AR dd/mm para >= 24h', () => {
      expect(formatOrderRelativeAge(null, baseNow)).toBe('');
      expect(formatOrderRelativeAge('fecha-invalida', baseNow)).toBe('');
      expect(formatOrderRelativeAge(new Date(baseNow - 60_000), baseNow)).toBe('recién');
      expect(formatOrderRelativeAge(new Date(baseNow - 14 * 60_000), baseNow)).toBe('hace 14m');
      expect(formatOrderRelativeAge(new Date(baseNow - 3 * 3_600_000), baseNow)).toBe('hace 3h');
      // 2026-11-10T01:30:00Z corresponde al 09/11 22:30 en America/Argentina/Buenos_Aires (-03:00)
      expect(formatOrderRelativeAge('2026-11-10T01:30:00.000Z', baseNow)).toBe('09/11');
    });
  });

  describe('resolveOrderOriginLabel & resolveOrderFiscalChannelBadge', () => {
    it('identifica origen preventista y mostrador correctamente', () => {
      expect(resolveOrderOriginLabel({ seller: { username: 'martin' } })).toBe('Prev. · martin');
      expect(resolveOrderOriginLabel({})).toBe('Mostrador');
    });

    it('identifica origen tienda web cuando hay código DV- o canal TIENDA_WEB', () => {
      expect(
        resolveOrderOriginLabel({
          bultosDetails: { webOrderId: 'DV-1042' },
        }),
      ).toBe('Web · DV-1042');
      expect(
        resolveOrderOriginLabel({
          notes: '[dv-2001] Retira mañana',
        }),
      ).toBe('Web · DV-2001');
      expect(
        resolveOrderOriginLabel({
          salesChannel: 'TIENDA_WEB',
        }),
      ).toBe('Tienda Web');
    });

    it('resuelve insignia fiscal A, B, C o X según tipo o CUIT', () => {
      expect(resolveOrderFiscalChannelBadge({ invoiceType: 'FACTURA_A' })).toMatchObject({
        code: 'A',
        isOfficial: true,
      });
      expect(resolveOrderFiscalChannelBadge({ invoiceType: 'FACTURA_B' })).toMatchObject({
        code: 'B',
        isOfficial: true,
      });
      expect(resolveOrderFiscalChannelBadge({ invoiceType: 'FACTURA_C' })).toMatchObject({
        code: 'C',
        isOfficial: true,
      });
      expect(
        resolveOrderFiscalChannelBadge({
          billingType: 'OFFICIAL',
          client: { cuit: '30-71234567-9' },
        }),
      ).toMatchObject({ code: 'A', isOfficial: true });
      expect(
        resolveOrderFiscalChannelBadge({
          billingType: 'OFFICIAL',
          client: { cuit: '' },
        }),
      ).toMatchObject({ code: 'B', isOfficial: true });
      expect(resolveOrderFiscalChannelBadge({ billingType: 'INTERNAL' })).toMatchObject({
        code: 'X',
        isOfficial: false,
      });
    });
  });

  describe('Totales BigInt y grilla adaptativa de Armado', () => {
    it('suma totales en pesos enteros exactos sin flotantes y formatea ARS', () => {
      const total = sumOrdersTotalInt([
        { totalAmount: '1000.5' },
        { totalAmount: 2000.4 },
        { totalAmount: '300' },
      ]);
      expect(total).toBe(3301n);
      expect(formatBigIntARS(total)).toBe('$3.301');
      expect(formatBigIntARS(312450n)).toBe('$312.450');
      expect(formatBigIntARS(-1500n)).toBe('-$1.500');
    });

    it('comprime columnas vacías y equilibra si todas están en cero', () => {
      expect(computeAdaptiveFulfillmentColumns(0, 0, 0)).toBe('repeat(3, minmax(260px, 1fr))');
      expect(computeAdaptiveFulfillmentColumns(5, 0, 1)).toBe(
        'minmax(310px, 1.35fr) minmax(210px, 0.55fr) minmax(310px, 1.35fr)',
      );
    });
  });

  describe('Libro IVA Digital AFIP: BigInt en centavos y calendario', () => {
    it('acumula ventas (+ y NC -) y compras en centavos exactos', () => {
      const metrics = accumulateAfipMetricsBigInt(
        [
          { neto: '100.10', iva: '21.02', total: '121.12', sign: 1 },
          { neto: '10.00', iva: '2.10', total: '12.10', sign: -1 },
        ],
        [{ neto: '50.05', iva: '10.51', total: '60.56' }],
      );

      expect(metrics.ventasNetoCents).toBe(9010n);
      expect(metrics.ventasIvaCents).toBe(1892n);
      expect(metrics.ventasTotalCents).toBe(10902n);
      expect(metrics.comprasNetoCents).toBe(5005n);
      expect(metrics.comprasIvaCents).toBe(1051n);
      expect(metrics.comprasTotalCents).toBe(6056n);
    });

    it('formatea centavos ARS y calcula el último día real de cada mes', () => {
      expect(formatCentsARS(124055n)).toBe('$ 1.240,55');
      expect(formatCentsARS(124000n)).toBe('$ 1.240');
      expect(formatCentsARS(124000n, true)).toBe('$ 1.240,00');
      expect(formatCentsARS(-505n)).toBe('-$ 5,05');

      expect(resolveAfipPeriodLastDay(2, 2026)).toBe(28);
      expect(resolveAfipPeriodLastDay(2, 2024)).toBe(29);
      expect(resolveAfipPeriodLastDay(11, 2026)).toBe(30);
    });
  });
});
