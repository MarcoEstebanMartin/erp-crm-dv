import { describe, expect, it } from 'vitest';
import { Role } from '@prisma/client';
import {
  evaluateReceiptVoidPermission,
  isSameArgentinaDay,
  toArgentinaDateKey,
} from './receipt-void.engine';

describe('receipt-void.engine', () => {
  const sameDayMorningAr = new Date('2026-11-25T12:00:00.000Z'); // 09:00 AR
  const sameDayNightAr = new Date('2026-11-26T01:30:00.000Z'); // 22:30 AR (mismo día 25/11)
  const nextDayMorningAr = new Date('2026-11-26T12:00:00.000Z'); // 09:00 AR (26/11)

  it('compara días usando calendario de Argentina y no UTC', () => {
    expect(toArgentinaDateKey(sameDayMorningAr)).toBe('2026-11-25');
    expect(toArgentinaDateKey(sameDayNightAr)).toBe('2026-11-25');
    expect(isSameArgentinaDay(sameDayMorningAr, sameDayNightAr)).toBe(true);
    expect(isSameArgentinaDay(sameDayMorningAr, nextDayMorningAr)).toBe(false);
  });

  it('rechaza con 409 si el recibo ya fue anulado (incluso para ADMIN)', () => {
    const res = evaluateReceiptVoidPermission({
      userRole: Role.ADMIN,
      createdAt: sameDayMorningAr,
      now: sameDayMorningAr,
      verified: false,
      alreadyVoided: true,
      isFieldReceipt: false,
    });
    expect(res.allowed).toBe(false);
    expect(res.statusCode).toBe(409);
  });

  it('rechaza con 409 si es un recibo emitido en calle', () => {
    const res = evaluateReceiptVoidPermission({
      userRole: Role.ADMIN,
      createdAt: sameDayMorningAr,
      now: sameDayMorningAr,
      verified: false,
      alreadyVoided: false,
      isFieldReceipt: true,
      fieldReceiptLabel: 'REC-C-00012',
    });
    expect(res.allowed).toBe(false);
    expect(res.statusCode).toBe(409);
    expect(res.reason).toContain('REC-C-00012');
  });

  it('permite a FACTURACION anular un recibo del mismo día, sin verificar y con caja abierta', () => {
    const res = evaluateReceiptVoidPermission({
      userRole: Role.FACTURACION,
      createdAt: sameDayMorningAr,
      now: sameDayNightAr,
      verified: false,
      alreadyVoided: false,
      isFieldReceipt: false,
      cashDrawerStatus: 'OPEN',
    });
    expect(res.allowed).toBe(true);
  });

  it('bloquea a FACTURACION si el recibo ya está verificado/rendido', () => {
    const res = evaluateReceiptVoidPermission({
      userRole: Role.FACTURACION,
      createdAt: sameDayMorningAr,
      now: sameDayNightAr,
      verified: true,
      alreadyVoided: false,
      isFieldReceipt: false,
      cashDrawerStatus: 'OPEN',
    });
    expect(res.allowed).toBe(false);
    expect(res.statusCode).toBe(403);
    expect(res.reason).toMatch(/verificado/i);
  });

  it('bloquea a FACTURACION si la caja asociada ya fue cerrada', () => {
    const res = evaluateReceiptVoidPermission({
      userRole: Role.FACTURACION,
      createdAt: sameDayMorningAr,
      now: sameDayNightAr,
      verified: false,
      alreadyVoided: false,
      isFieldReceipt: false,
      cashDrawerStatus: 'CLOSED',
    });
    expect(res.allowed).toBe(false);
    expect(res.statusCode).toBe(403);
    expect(res.reason).toMatch(/caja/i);
  });

  it('bloquea a FACTURACION si el recibo es de un día anterior', () => {
    const res = evaluateReceiptVoidPermission({
      userRole: Role.FACTURACION,
      createdAt: sameDayMorningAr,
      now: nextDayMorningAr,
      verified: false,
      alreadyVoided: false,
      isFieldReceipt: false,
      cashDrawerStatus: null,
    });
    expect(res.allowed).toBe(false);
    expect(res.statusCode).toBe(403);
    expect(res.reason).toMatch(/mismo día/i);
  });

  it('permite a ADMIN anular recibos de días anteriores, verificados o de caja cerrada', () => {
    const res = evaluateReceiptVoidPermission({
      userRole: Role.ADMIN,
      createdAt: sameDayMorningAr,
      now: nextDayMorningAr,
      verified: true,
      alreadyVoided: false,
      isFieldReceipt: false,
      cashDrawerStatus: 'CLOSED',
    });
    expect(res.allowed).toBe(true);
  });

  it('bloquea a roles no autorizados (VENDEDOR / DEPOSITO)', () => {
    const res = evaluateReceiptVoidPermission({
      userRole: Role.VENDEDOR,
      createdAt: sameDayMorningAr,
      now: sameDayMorningAr,
      verified: false,
      alreadyVoided: false,
      isFieldReceipt: false,
    });
    expect(res.allowed).toBe(false);
    expect(res.statusCode).toBe(403);
  });
});
