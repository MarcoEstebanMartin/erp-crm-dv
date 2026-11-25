import { describe, it, expect } from 'vitest';
import {
  cleanVarietiesText,
  computeMarginPercent,
  formatCatalogPrice,
  groupCatalogSections,
  normalizeCatalogBadge,
  normalizeCatalogCategory,
  parseMinQtyBadge,
  splitBrandAndDescription,
} from './catalog-studio.engine';

describe('catalog-studio.engine', () => {
  it('formatea precios en pesos enteros con separador de miles sin centavos fantasma', () => {
    expect(formatCatalogPrice(11156)).toBe('$11.156');
    expect(formatCatalogPrice(8999.6)).toBe('$9.000');
    expect(formatCatalogPrice(8999.4)).toBe('$8.999');
    expect(formatCatalogPrice(550)).toBe('$550');
  });

  it('calcula margen real con Decimal.js y devuelve null si falta costo', () => {
    expect(computeMarginPercent(1200, 1000)).toBe(20);
    expect(computeMarginPercent(950, 1000)).toBe(-5);
    expect(computeMarginPercent(1200, 0)).toBeNull();
    expect(computeMarginPercent(1200, null)).toBeNull();
  });

  it('normaliza categorías y mantiene orden canónico con COMBOS primero', () => {
    expect(normalizeCatalogCategory('MELINCUE')).toBe('Melincué');
    expect(normalizeCatalogCategory('NO COMESTIBLES')).toBe('Limpieza');
    expect(normalizeCatalogCategory('ACEITES Y VINAGRES')).toBe('Aceites y Vinagres');

    const sections = groupCatalogSections(
      [
        { id: 1, sku: '0100', name: 'RAID AEROSOL', price: 7889, category: 'Limpieza' },
        { id: 2, sku: '0001', name: 'BARRA TYBO X KG', price: 11156, category: 'MELINCUE' },
      ],
      [
        {
          id: 'combo-1',
          comboNum: 'COMBO 1',
          title: 'PROMO VERANO',
          product1: { name: 'FERNET BRANCA 750', price: 17000, condition: '1 BULTO' },
          product2: { name: 'COCA COLA 2.25L', price: 0, condition: '1 PACK', isFree: true },
        },
      ],
    );

    expect(sections.map((s) => s.name)).toEqual(['COMBOS', 'Melincué', 'Limpieza']);
    expect(sections[0].combos).toHaveLength(1);
    expect(sections[1].products[0].sku).toBe('0001');
  });

  it('parsea correctamente badges de cantidad mínima (unidades, cajas, bultos y fallback)', () => {
    expect(parseMinQtyBadge('3 UNID.')).toEqual({ top: 'MÍNIMO', center: '3', bottom: 'UNID.' });
    expect(parseMinQtyBadge('3 CAJA')).toEqual({ top: 'MÍNIMO', center: '3', bottom: 'CAJA' });
    expect(parseMinQtyBadge('2 BULTOS')).toEqual({ top: 'MÍNIMO', center: '2', bottom: 'BULTO' });
    expect(parseMinQtyBadge(null, 6)).toEqual({ top: 'MÍNIMO', center: '6', bottom: 'UNID.' });
    expect(parseMinQtyBadge('SIN MINIMO', 6)).toBeNull();
    expect(parseMinQtyBadge(null, 1)).toBeNull();
  });

  it('limpia variedades y separa marca/descripción respetando Melincué y marcas compuestas', () => {
    expect(cleanVarietiesText('Sabores: (Frutilla - Vainilla)')).toBe('FRUTILLA - VAINILLA');
    expect(splitBrandAndDescription('MELINCUE BARRA TYBO X KG', 'Melincué')).toEqual({
      brand: 'MELINCUÉ',
      description: 'BARRA TYBO X KG',
    });
    expect(splitBrandAndDescription('BONDIOLA VAC. HORMA X KG LA CASONA', 'Fiambres')).toEqual({
      brand: 'LA CASONA',
      description: 'BONDIOLA VAC. HORMA X KG',
    });
    expect(normalizeCatalogBadge('¡Ofertón!')).toBe('OFERTON');
    expect(normalizeCatalogBadge('destacado')).toBe('DESTACADO');
    expect(normalizeCatalogBadge('')).toBeNull();
  });
});
