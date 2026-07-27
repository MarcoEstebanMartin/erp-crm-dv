import { describe, it, expect } from '@jest/globals';
import { PricingService } from '../pricing.service';
import { Persona, BillingType } from '@prisma/client';

describe('PricingService Unit Tests (Motor de Precios y Reglas)', () => {
  const mockPersonaListA: Persona = {
    id: 1,
    name: 'Cliente Lista A',
    cuit: '20123456789',
    address: null,
    city: null,
    province: null,
    zipCode: null,
    phone: null,
    email: null,
    rubro: null,
    isClient: true,
    isProvider: false,
    isSeller: false,
    isCommissionAgent: false,
    creditLimit: 0 as any,
    maxUnpaidInvoices: 0 as any,
    priceList: 'A',
    discount: 5 as any, // 5% descuento general de cliente
    contacts: null,
    outstandingBalance: 0 as any,
    route: null,
    saleRouteId: null,
    routeSequence: null,
    latitude: null,
    longitude: null,
    sellerId: null,
    iibbAliquot: 0 as any,
    paymentTermDays: 30,
    webPin: null,
    birthDate: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPersonaListB: Persona = {
    ...mockPersonaListA,
    id: 2,
    name: 'Cliente Lista B',
    priceList: 'B',
    discount: 0 as any,
  };

  const mockProduct = {
    id: 10,
    sku: 'PROD-001',
    name: 'Queso Cremoso',
    listPrice: 1000,
    listPriceB: 950,
    listPriceC: 900,
    rubroId: 5,
    isPesable: true,
  };

  it('Debe aplicar el precio base según la lista A del cliente y su descuento general', () => {
    const res = PricingService.calculatePriceAndDiscountInMemory(
      mockProduct,
      mockPersonaListA,
      []
    );

    expect(res.basePrice).toBe(1000);
    expect(res.discount).toBe(5);
    expect(res.finalPrice).toBe(950); // 1000 - 5% = 950
  });

  it('Debe aplicar el precio base según la lista B del cliente si listPriceB > 0', () => {
    const res = PricingService.calculatePriceAndDiscountInMemory(
      mockProduct,
      mockPersonaListB,
      []
    );

    expect(res.basePrice).toBe(950);
    expect(res.discount).toBe(0);
    expect(res.finalPrice).toBe(950);
  });

  it('Debe priorizar una regla de descuento por Producto sobre una regla general por Lista de Precios', () => {
    const rules = [
      { id: 1, name: 'Descuento Lista A', priceList: 'A', discount: 10 },
      { id: 2, name: 'Descuento Específico Producto', productId: 10, discount: 20 },
    ];

    const res = PricingService.calculatePriceAndDiscountInMemory(
      mockProduct,
      mockPersonaListA,
      rules
    );

    expect(res.discount).toBe(20);
    expect(res.ruleName).toBe('Descuento Específico Producto');
    expect(res.finalPrice).toBe(800); // 1000 - 20% = 800
  });

  it('Debe ignorar reglas con BillingType no coincidente', () => {
    const rules = [
      { id: 1, name: 'Descuento Solo Oficial', productId: 10, billingType: BillingType.OFFICIAL, discount: 30 },
    ];

    const res = PricingService.calculatePriceAndDiscountInMemory(
      mockProduct,
      mockPersonaListA,
      rules,
      BillingType.INTERNAL // Pedido interno
    );

    // No aplica la regla OFFICIAL, usa el 5% de descuento por defecto del cliente
    expect(res.discount).toBe(5);
    expect(res.finalPrice).toBe(950);
  });
});
