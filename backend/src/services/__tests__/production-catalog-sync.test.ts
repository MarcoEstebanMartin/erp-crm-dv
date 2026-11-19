import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { Decimal } from 'decimal.js';
import {
  computeClampedMarginPct,
  computeErpProductSyncPatch,
  computeProportionalTierPrice,
  extractVariantParentSku,
  resolveMasterArchiveExtension,
  resolveSyncedImageFilename,
} from '../../engines/catalog-sync.engine';
import { writeProductUploadAtomically } from '../catalog/production-catalog-sync.service';

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

  it('escribe atómicamente en uploads/products y purga versiones viejas del mismo SKU sin dejar huérfanos', () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dv-u2-test-'));
    const uploadsDir = path.join(tmpRoot, 'uploads');
    fs.mkdirSync(uploadsDir, { recursive: true });

    try {
      fs.writeFileSync(path.join(uploadsDir, '0031.jpg'), Buffer.from('OLD_JULY_0031_JPG'));
      fs.writeFileSync(path.join(uploadsDir, '0021.jpg'), Buffer.from('OTHER_SKU_0021'));

      const newHdPng = Buffer.from('NEW_HD_PNG_FROM_PRODUCTION_0031');
      const res = writeProductUploadAtomically(
        '0031',
        '0031_1794344664.png',
        newHdPng,
        uploadsDir,
      );

      expect(res.prunedCount).toBe(1);
      expect(fs.existsSync(path.join(uploadsDir, '0031.jpg'))).toBe(false);
      expect(fs.readFileSync(path.join(uploadsDir, '0031_1794344664.png')).equals(newHdPng)).toBe(true);
      expect(fs.existsSync(path.join(uploadsDir, '0021.jpg'))).toBe(true);
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it('detecta SKU padre en variantes desdobladas (Padre -> Variantes) y resguarda nombres propios', () => {
    expect(extractVariantParentSku('0504-1')).toBe('0504');
    expect(extractVariantParentSku('0149-4')).toBe('0149');
    expect(extractVariantParentSku('0504')).toBeNull();
    expect(extractVariantParentSku('ABC-DEF')).toBeNull();

    const syncDate = new Date('2026-11-19T11:30:00.000Z');
    const parentProdRow = {
      sku: '0504',
      name: 'MOCORETÁ GASEOSA 6X2.25 LTS',
      price: 1603,
      active: 1,
      min_qty: '6',
      category: 'Bebidas',
    };

    // 1. El padre agrupado se desactiva en el ERP (forceInactive: true)
    const parentPatch = computeErpProductSyncPatch(
      {
        id: 1621,
        sku: '0504',
        name: 'MOCORETÁ GASEOSA 6X2.25 LTS',
        costPrice: '1282.40',
        listPrice: '1603.00',
        listPriceB: '1603.00',
        listPriceC: '1603.00',
        profitMargin: '25.00',
        imageUrl: '/uploads/products/0504_1790527059.png',
        isActive: true,
        isPesable: false,
        unitsPerBox: 6,
        minOrderQuantity: 6,
        approximateWeight: null,
        commercialCategory: 'Bebidas',
      },
      parentProdRow,
      '/uploads/products/0504_1790527059.png',
      syncDate,
      113,
      { forceInactive: true },
    );
    expect(parentPatch.hasChanges).toBe(true);
    expect(parentPatch.activeChanged).toBe(true);
    expect(parentPatch.updateData.isActive).toBe(false);

    // 2. La variante hereda precio, activo, mínimo, costo, unitsPerBox y proveedor SIN perder su nombre con sabor
    const variantPatch = computeErpProductSyncPatch(
      {
        id: 2764,
        sku: '0504-1',
        name: 'MOCORETA GASEOSA COLA 6x2.25 LTS',
        costPrice: '0.00',
        listPrice: '9163.00',
        listPriceB: '9163.00',
        listPriceC: '9163.00',
        profitMargin: null,
        imageUrl: '/uploads/products/0504-1_1790975005.png',
        isActive: false,
        isPesable: false,
        unitsPerBox: 1,
        minOrderQuantity: 1,
        approximateWeight: null,
        commercialCategory: 'Bebidas',
        providerId: null,
      },
      parentProdRow,
      '/uploads/products/0504-1_1790975005.png',
      syncDate,
      113,
      {
        preserveName: true,
        inheritedCostPrice: '1282.40',
        inheritedUnitsPerBox: 6,
        inheritedProviderId: 8717,
      },
    );

    expect(variantPatch.hasChanges).toBe(true);
    expect(variantPatch.nameChanged).toBe(false);
    expect(variantPatch.updateData.name).toBeUndefined();
    expect(variantPatch.updateData.isActive).toBe(true);
    expect(variantPatch.updateData.listPrice).toBe(1603);
    expect(variantPatch.updateData.listPriceB).toBe(1603);
    expect(variantPatch.updateData.listPriceC).toBe(1603);
    expect(variantPatch.updateData.costPrice).toBe(1282.4);
    expect(variantPatch.updateData.profitMargin).toBe(25);
    expect(variantPatch.updateData.minOrderQuantity).toBe(6);
    expect(variantPatch.updateData.unitsPerBox).toBe(6);
    expect(variantPatch.updateData.providerId).toBe(8717);
  });
});
