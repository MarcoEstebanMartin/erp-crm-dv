import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { Decimal } from 'decimal.js';
import {
  computeClampedMarginPct,
  computeErpProductSyncPatch,
  computeProportionalTierPrice,
  resolveMasterArchiveExtension,
  resolveSyncedImageFilename,
} from '../../engines/catalog-sync.engine';
import { writeImageSafelyProtectingMaster } from '../catalog/production-catalog-sync.service';

describe('Paso U2 — Motor y Servicio de Sincronización Producción -> ERP', () => {
  it('redondea precios de Producción al peso entero en origen y preserva proporciones Lista B/C', () => {
    const syncDate = new Date('2026-11-10T21:00:00.000Z');
    const patch = computeErpProductSyncPatch(
      {
        id: 1742,
        sku: '0008',
        name: 'MELINCUÉ MOZZARELLA BARRA X KG',
        costPrice: '9706.40',
        listPrice: '12075.00',
        listPriceB: '11713.00',
        listPriceC: '11471.00',
        profitMargin: '24.40',
        imageUrl: '/uploads/products/0008.jpg',
        isActive: true,
        isPesable: true,
        minOrderQuantity: 1,
        approximateWeight: '4.000',
      },
      {
        sku: '0008',
        name: 'MELINCUÉ MOZZARELLA BARRA X KG',
        price: 11712.4,
        active: 1,
        min_qty: '',
        peso_promedio: 4,
      },
      '/uploads/products/0008_1794259999.png',
      syncDate,
    );

    expect(patch.hasChanges).toBe(true);
    expect(patch.priceChanged).toBe(true);
    expect(patch.imageChanged).toBe(true);
    expect(patch.updateData.listPrice).toBe(11712);
    expect(patch.updateData.previousListPrice).toBe(12075);
    expect(patch.updateData.listPriceB).toBe(11361);
    expect(patch.updateData.listPriceC).toBe(11126);
    expect(patch.updateData.imageUrl).toBe('/uploads/products/0008_1794259999.png');
    expect(patch.updateData.profitMargin).toBe(20.66);
  });

  it('acota márgenes extremos a [-999.99, 999.99] evitando overflow en NUMERIC(5,2)', () => {
    expect(computeClampedMarginPct(new Decimal(10), new Decimal(50000))).toBe(999.99);
    expect(computeClampedMarginPct(new Decimal(6076), new Decimal(677))).toBe(-88.86);
    expect(computeClampedMarginPct(new Decimal(0), new Decimal(1500))).toBeNull();
    expect(
      computeProportionalTierPrice(new Decimal(9112), new Decimal(8637), new Decimal(8637)).toNumber(),
    ).toBe(9112);
  });

  it('espeja exactamente el estado activo de donvenancio.com.ar sin borrar filas ausentes', () => {
    const baseErp = {
      id: 99,
      sku: '0999',
      name: 'PRODUCTO LEGACY ERP',
      costPrice: '1000.00',
      listPrice: '1500.00',
      listPriceB: '1500.00',
      listPriceC: '1500.00',
      profitMargin: '50.00',
      imageUrl: null,
      isActive: true,
      isPesable: false,
      minOrderQuantity: 1,
      approximateWeight: null,
    };

    const absentPatch = computeErpProductSyncPatch(baseErp, undefined, null);
    expect(absentPatch.hasChanges).toBe(true);
    expect(absentPatch.activeChanged).toBe(true);
    expect(absentPatch.updateData).toEqual({ isActive: false });

    const reactivatedPatch = computeErpProductSyncPatch(
      { ...baseErp, isActive: false },
      { sku: '0999', name: 'PRODUCTO REACTIVADO WEB', price: 1500, active: 1, min_qty: '4' },
      '/uploads/products/0999_1794340000.png',
    );
    expect(reactivatedPatch.activeChanged).toBe(true);
    expect(reactivatedPatch.updateData.isActive).toBe(true);
    expect(reactivatedPatch.updateData.minOrderQuantity).toBe(4);
  });

  it('resuelve nombres de archivo anti-colisión preservando sufijos versionados', () => {
    expect(
      resolveSyncedImageFilename('0021', '0021_1794342783.png', 'image/png', 'abcdef1234567890'),
    ).toBe('0021_1794342783.png');

    expect(
      resolveSyncedImageFilename('0029', '0029.jpg', 'image/jpeg', '8f3a1c2b99887766'),
    ).toBe('0029_dv_8f3a1c2b.jpg');

    expect(resolveMasterArchiveExtension('foto.jpeg', 'image/jpeg')).toBe('.jpg');
    expect(resolveMasterArchiveExtension(null, 'image/png')).toBe('.png');
  });

  it('protege la carpeta sagrada ARCHIVOS/fotos/Productos sin sobrescribir archivos existentes', () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dv-u2-test-'));
    const uploadsDir = path.join(tmpRoot, 'uploads');
    const masterDir = path.join(tmpRoot, 'master');
    fs.mkdirSync(uploadsDir, { recursive: true });
    fs.mkdirSync(masterDir, { recursive: true });

    try {
      // Caso 1: SKU 0031 YA existe como 0031.jpg en carpeta maestra -> jamás debe tocarse ni agregar 0031.png
      const sacredOriginal = Buffer.from('SACRED_MASTER_0031_JPG');
      fs.writeFileSync(path.join(masterDir, '0031.jpg'), sacredOriginal);
      const existingMasterStems = new Set(['0031']);

      const newHdPng = Buffer.from('NEW_HD_PNG_FROM_PRODUCTION_0031');
      const resExisting = writeImageSafelyProtectingMaster(
        '0031',
        '0031_1794344664.png',
        '.png',
        newHdPng,
        uploadsDir,
        masterDir,
        existingMasterStems,
      );

      expect(resExisting.wroteNewMaster).toBe(false);
      expect(fs.readFileSync(path.join(masterDir, '0031.jpg')).equals(sacredOriginal)).toBe(true);
      expect(fs.existsSync(path.join(masterDir, '0031.png'))).toBe(false);
      expect(fs.readFileSync(path.join(uploadsDir, '0031_1794344664.png')).equals(newHdPng)).toBe(true);

      // Caso 2: SKU 0021 NO existe en carpeta maestra -> agrega 0021.png nuevo limpiamente
      const new0021Buf = Buffer.from('NEW_HD_PNG_0021');
      const resMissing = writeImageSafelyProtectingMaster(
        '0021',
        '0021_1794342783.png',
        '.png',
        new0021Buf,
        uploadsDir,
        masterDir,
        existingMasterStems,
      );

      expect(resMissing.wroteNewMaster).toBe(true);
      expect(fs.readFileSync(path.join(masterDir, '0021.png')).equals(new0021Buf)).toBe(true);
      expect(fs.readFileSync(path.join(uploadsDir, '0021_1794342783.png')).equals(new0021Buf)).toBe(true);
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});
