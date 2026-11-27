import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { fieldReceiptToPublicData } from '../FieldTodayReceiptsCard';
import { filterFieldCollectionClients } from '../FieldCollectionPage';
import { buildSearchIndex } from '../../vendedor/vendedorHelpers';
import type { FieldReceiptDTO, OfflineBundleClient } from '../../../api/fieldReceipts.api';

const baseReceipt: FieldReceiptDTO = {
  id: 42,
  receiptNumber: 'REC-C-0000042',
  provisionalCode: 'PROV-10-XYZ',
  personaId: 7,
  persona: { id: 7, name: 'ALMACEN DON PEDRO', phone: '3454123456' },
  totalAmount: 15000,
  status: 'ISSUED',
  capturedAt: '2026-11-21T12:00:00.000Z',
  whatsappStatus: 'PENDING',
  whatsappError: null,
  pdfUrl: '/uploads/receipts/REC-C-0000042.pdf',
  payments: [
    {
      id: 1,
      paymentMethod: 'CASH',
      amount: 15000,
      status: 'IN_TRANSIT',
      bankAccountId: null,
      transferReference: null,
      proofImageUrl: null,
      checkBank: null,
      checkNumber: null,
      checkDueDate: null,
      checkFrontImageUrl: null,
      isEcheq: false,
      rejectionReason: null,
    },
  ],
};

describe('Recibos de Vendedores (UI y PDF moderno)', () => {
  it('convierte un FieldReceiptDTO en PublicReceiptData limpio para el PDF moderno', () => {
    const mapped = fieldReceiptToPublicData(baseReceipt);
    expect(mapped.id).toBe(42);
    expect(mapped.receiptNumber).toBe('REC-C-0000042');
    expect(mapped.amount).toBe(15000);
    expect(mapped.paymentMethod).toBe('CASH');
    expect(mapped.description).toBe('Pago a cuenta corriente');
    expect(mapped.verificationCode).toBe('PROV-10-XYZ');
    expect(mapped.persona?.name).toBe('ALMACEN DON PEDRO');
  });

  it('incluye el detalle de medios múltiples o cheque en la descripción del PDF', () => {
    const multi = fieldReceiptToPublicData({
      ...baseReceipt,
      payments: [
        ...baseReceipt.payments,
        {
          ...baseReceipt.payments[0],
          id: 2,
          paymentMethod: 'CHECK',
          amount: 5000,
          checkBank: 'Nación',
          checkNumber: '987654',
        },
      ],
    });
    expect(multi.description).toContain('Cheque N° 987654');

    const mixed = fieldReceiptToPublicData({
      ...baseReceipt,
      payments: [
        ...baseReceipt.payments,
        {
          ...baseReceipt.payments[0],
          id: 3,
          paymentMethod: 'BANK_TRANSFER',
          amount: 5000,
        },
      ],
    });
    expect(mixed.description).toBe('Pago a cuenta corriente (Efectivo + Transferencia)');
  });

  it('usa NativeModalDialog centrado en FieldCollectModal y mantiene todos los archivos bajo 450 líneas', () => {
    const dir = path.resolve(__dirname, '..');
    const modalSrc = fs.readFileSync(path.join(dir, 'FieldCollectModal.tsx'), 'utf8');
    const pageSrc = fs.readFileSync(path.join(dir, 'FieldCollectionPage.tsx'), 'utf8');
    const rowSrc = fs.readFileSync(path.join(dir, 'FieldCollectPaymentRow.tsx'), 'utf8');
    const cardSrc = fs.readFileSync(path.join(dir, 'FieldTodayReceiptsCard.tsx'), 'utf8');
    const waModalSrc = fs.readFileSync(path.join(dir, 'ReceiptWhatsAppSendModal.tsx'), 'utf8');

    expect(modalSrc).toContain('NativeModalDialog');
    expect(modalSrc).not.toMatch(/<dialog\b/);

    // El vendedor solo puede enviar por WhatsApp (sin botón de descarga PDF directo) para capturar números
    expect(pageSrc).not.toContain('downloadReceiptPdf');
    expect(cardSrc).not.toContain('downloadReceiptPdf');
    expect(waModalSrc).not.toContain('downloadReceiptPdf');

    // Recibos de hoy aparece antes del buscador/listado de 60 clientes
    expect(pageSrc.indexOf('<FieldTodayReceiptsCard')).toBeGreaterThan(-1);
    expect(pageSrc.indexOf('<FieldTodayReceiptsCard')).toBeLessThan(pageSrc.indexOf('<search'));

    expect(modalSrc.split('\n').length).toBeLessThanOrEqual(450);
    expect(pageSrc.split('\n').length).toBeLessThanOrEqual(450);
    expect(rowSrc.split('\n').length).toBeLessThanOrEqual(450);
    expect(cardSrc.split('\n').length).toBeLessThanOrEqual(450);
    expect(waModalSrc.split('\n').length).toBeLessThanOrEqual(450);
  });

  it('muestra badge A/X y filtro por sucursal en UnifiedReceiptsList manteniendo archivos bajo 450 líneas', () => {
    const dir = path.resolve(__dirname, '..');
    const listSrc = fs.readFileSync(path.join(dir, 'UnifiedReceiptsList.tsx'), 'utf8');
    const rowItemSrc = fs.readFileSync(path.join(dir, 'UnifiedReceiptRowItem.tsx'), 'utf8');

    expect(listSrc).toContain('billingFilter');
    expect(listSrc).toContain('Suc. A');
    expect(listSrc).toContain('Suc. X');
    expect(rowItemSrc).toContain('Sucursal A (Oficial)');
    expect(rowItemSrc).toContain('Sucursal X (Interno)');

    expect(listSrc.split('\n').length).toBeLessThanOrEqual(450);
    expect(rowItemSrc.split('\n').length).toBeLessThanOrEqual(450);
  });

  it('muestra solo clientes con saldo > 0 en orden de ruta sin búsqueda y permite encontrar saldo 0 con la lupa', () => {
    const sampleClients: OfflineBundleClient[] = [
      { id: 1, name: 'BECERRA LAURA', cuit: null, city: 'INTENDENTE ALVEAR', address: 'LAPRIDA 752', phone: null, whatsappVerifiedAt: null, outstandingBalance: 0, openInvoices: [] },
      { id: 2, name: 'DESPENSA ROMI', cuit: null, city: 'INTENDENTE ALVEAR', address: 'ISLA SOLEDAD', phone: null, whatsappVerifiedAt: null, outstandingBalance: 95997, openInvoices: [] },
      { id: 3, name: 'ALMACEN FAVOR', cuit: null, city: 'INTENDENTE ALVEAR', address: 'MITRE 10', phone: null, whatsappVerifiedAt: null, outstandingBalance: -1500, openInvoices: [] },
      { id: 4, name: 'KIOSCO CENTRAL', cuit: null, city: 'INTENDENTE ALVEAR', address: 'SAN MARTIN 20', phone: null, whatsappVerifiedAt: null, outstandingBalance: 12500, openInvoices: [] },
    ];
    const indexed = buildSearchIndex(sampleClients, (c) => [c.name, c.city, c.cuit, c.address]);

    // Sin búsqueda: solo saldo > 0, respetando orden de ruta original (id 2 antes que id 4)
    const defaultList = filterFieldCollectionClients(sampleClients, indexed, '');
    expect(defaultList.map((c) => c.id)).toEqual([2, 4]);

    // Con búsqueda en lupa: encuentra clientes con saldo 0 y saldo a favor
    const searchZero = filterFieldCollectionClients(sampleClients, indexed, 'becerra');
    expect(searchZero.map((c) => c.id)).toEqual([1]);

    const searchCredit = filterFieldCollectionClients(sampleClients, indexed, 'favor');
    expect(searchCredit.map((c) => c.id)).toEqual([3]);
  });

  it('para VENDEDOR muestra solo sus clientes por defecto y permite buscar clientes de otras rutas en la lupa', () => {
    const sampleClients: OfflineBundleClient[] = [
      { id: 10, name: 'ACUNA MARTA ALICIA', cuit: null, city: 'FORTÍN OLAVARRÍA', address: 'BVARD CORTELEZZI', phone: null, route: 'AMERICA Y FORTIN', saleRouteId: 124, saleRouteSellerId: 67, routeSequence: 1, outstandingBalance: 595599, sellerId: 67 },
      { id: 11, name: 'AICARDI MERCEDES BEATRIZ', cuit: null, city: 'BANDERALÓ', address: 'CACIQUE CURUPOTRO', phone: null, route: 'BANDERALO Y LARROUDE', saleRouteId: 123, saleRouteSellerId: 66, routeSequence: 2, outstandingBalance: 1489329, sellerId: 66 },
      { id: 12, name: 'ALAN CASTILLO', cuit: null, city: 'RIVADAVIA AMERICA', address: 'AMERICA 460', phone: null, route: 'AMERICA Y FORTIN', saleRouteId: 124, saleRouteSellerId: 67, routeSequence: 3, outstandingBalance: 1978190, sellerId: 67 },
      { id: 13, name: 'LEIVA LEONARDO FLAVIO', cuit: null, city: 'GENERAL VILLEGAS', address: 'MITRE 100', phone: null, route: 'VILLEGAS DIEGO', saleRouteId: 116, saleRouteSellerId: 66, routeSequence: 4, outstandingBalance: 85000, sellerId: 70 },
      { id: 14, name: 'DESPENSA ALVEAR', cuit: null, city: 'INTENDENTE ALVEAR', address: '9 DE JULIO 293', phone: null, route: 'ALVEAR', saleRouteId: 120, saleRouteSellerId: 69, routeSequence: 5, outstandingBalance: 120000, sellerId: 69 },
    ];
    const indexed = buildSearchIndex(sampleClients, (c) => [c.name, c.city, c.cuit, c.address]);

    // Diego (id 66, VENDEDOR) sin búsqueda: solo sus clientes (por sellerId o por saleRouteSellerId)
    const diegoDefault = filterFieldCollectionClients(sampleClients, indexed, '', 60, {
      collectorUserId: 66,
      collectorRole: 'VENDEDOR',
    });
    expect(diegoDefault.map((c) => c.id)).toEqual([11, 13]);

    // Con búsqueda en lupa: puede encontrar y cobrar clientes de América o Alvear por excepción
    const searchAmerica = filterFieldCollectionClients(sampleClients, indexed, 'alan castillo', 60, {
      collectorUserId: 66,
      collectorRole: 'VENDEDOR',
    });
    expect(searchAmerica.map((c) => c.id)).toEqual([12]);

    const searchAlvear = filterFieldCollectionClients(sampleClients, indexed, 'alvear', 60, {
      collectorUserId: 66,
      collectorRole: 'VENDEDOR',
    });
    expect(searchAlvear.map((c) => c.id)).toEqual([14]);

    // Para DEPOSITO / ADMIN: sin restricción de vendedor
    const adminDefault = filterFieldCollectionClients(sampleClients, indexed, '', 60, {
      collectorUserId: 73,
      collectorRole: 'ADMIN',
    });
    expect(adminDefault.map((c) => c.id)).toEqual([10, 11, 12, 13, 14]);
  });
});
