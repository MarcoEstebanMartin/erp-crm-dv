import { describe, expect, it } from 'vitest';
import {
  canCollectStop,
  computeStopSuggestedCollectAmount,
  getStopOutstandingBalance,
} from '../repartoRouteHelpers';

describe('repartoRouteHelpers — control de cobro según saldo del cliente', () => {
  it('oculta Cobrar cuando el cliente tiene saldo $0 aunque el pedido tenga importe', () => {
    const stop = {
      id: 101,
      totalAmount: 80620,
      persona: { id: 10, name: 'MARTIN MARCO ESTEBAN', outstandingBalance: 0 },
    };

    expect(getStopOutstandingBalance(stop)).toBe(0);
    expect(canCollectStop('IN_TRANSIT', stop)).toBe(false);
    expect(canCollectStop('PENDING', stop)).toBe(false);
    expect(computeStopSuggestedCollectAmount(stop)).toBe(0);
  });

  it('oculta Cobrar cuando el cliente tiene saldo a favor (negativo)', () => {
    const stop = {
      id: 102,
      totalAmount: 36546,
      persona: { id: 10, name: 'MARTIN MARCO ESTEBAN', outstandingBalance: '-5000' },
    };

    expect(getStopOutstandingBalance(stop)).toBe(-5000);
    expect(canCollectStop('IN_TRANSIT', stop)).toBe(false);
    expect(computeStopSuggestedCollectAmount(stop)).toBe(0);
  });

  it('habilita Cobrar en viajes activos cuando el cliente tiene saldo > $0 y topea el sugerido al saldo real', () => {
    const stopPartialDebt = {
      id: 103,
      totalAmount: 80620,
      persona: { id: 20, name: 'DUFOURC MARCOS DANIEL', outstandingBalance: 30000 },
    };
    expect(canCollectStop('IN_TRANSIT', stopPartialDebt)).toBe(true);
    expect(computeStopSuggestedCollectAmount(stopPartialDebt)).toBe(30000);

    const stopFullDebt = {
      id: 104,
      totalAmount: 45724,
      persona: { id: 21, name: 'CLIENTE CON DEUDA MAYOR', outstandingBalance: 120000 },
    };
    expect(canCollectStop('IN_TRANSIT', stopFullDebt)).toBe(true);
    expect(computeStopSuggestedCollectAmount(stopFullDebt)).toBe(45724);
  });

  it('nunca habilita Cobrar si el viaje está COMPLETED', () => {
    const stop = {
      id: 105,
      totalAmount: 45724,
      persona: { id: 21, outstandingBalance: 45724 },
    };

    expect(canCollectStop('COMPLETED', stop)).toBe(false);
  });
});
