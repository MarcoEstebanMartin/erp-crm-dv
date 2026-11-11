import { describe, it, expect } from 'vitest';
import {
  formatIntegerARS,
  formatIntegerNumberAR,
  roundHalfUpInteger,
} from '../currency';
import {
  generateSafeIdempotencyKey,
  resolveRequestIdempotencyKey,
} from '../idempotencyClient';
import { getOrderStatusInfo } from '../orderStatusHelper';
import { formatResponsibleName } from '../formatters';

describe('Frontend Core — Pesos Enteros, Idempotencia Móvil y Estados Logísticos', () => {
  it('roundHalfUpInteger y formatIntegerARS redondean al peso entero exacto sin centavos fantasma ni ,00', () => {
    expect(roundHalfUpInteger(102479.34)).toBe(102479);
    expect(roundHalfUpInteger(102479.5)).toBe(102480);
    expect(roundHalfUpInteger('4666.65')).toBe(4667);
    expect(roundHalfUpInteger(-1500.5)).toBe(-1501);
    expect(roundHalfUpInteger(null)).toBe(0);

    expect(formatIntegerNumberAR(102479.34)).toBe('102.479');
    expect(formatIntegerARS(102479.34)).toBe('$102.479');
    expect(formatIntegerARS(-2500.4)).toBe('-$2.500');
  });

  it('resolveRequestIdempotencyKey deduplica dobles clics en ventana de 3s y respeta claves explícitas offline', () => {
    const keyA = resolveRequestIdempotencyKey('POST', '/api/orders', '{"personaId":10}');
    const keyB = resolveRequestIdempotencyKey('POST', '/api/orders', '{"personaId":10}');
    const keyDifferentPayload = resolveRequestIdempotencyKey(
      'POST',
      '/api/orders',
      '{"personaId":11}',
    );

    expect(keyA).toBe(keyB);
    expect(keyA).not.toBe(keyDifferentPayload);

    const offlineKey = 'offline-order-uuid-123456';
    expect(
      resolveRequestIdempotencyKey('POST', '/api/orders', '{"personaId":10}', offlineKey),
    ).toBe(offlineKey);
    expect(generateSafeIdempotencyKey().length).toBeGreaterThanOrEqual(16);
  });

  it('getOrderStatusInfo y formatResponsibleName resuelven etiquetas operativas limpias', () => {
    expect(getOrderStatusInfo({ status: 'PREPARED', invoiceNumber: null }).label).toBe('Armado');
    expect(
      getOrderStatusInfo({
        status: 'PREPARED',
        deliveryRoute: { status: 'IN_TRANSIT' },
      }).label,
    ).toBe('En Viaje');
    expect(getOrderStatusInfo({ status: 'DELIVERED', invoiceNumber: '00001-00000123' }).label).toBe(
      'Facturado',
    );

    expect(formatResponsibleName({ branch: 'Caja: VENDEDOR: DIEGO (Ruta #1)' })).toBe(
      'Diego Lejarza',
    );
    expect(
      formatResponsibleName({
        user: { employee: { firstName: 'Esteban', lastName: 'Martin' } },
      }),
    ).toBe('Esteban Martin');
  });
});
