import { describe, expect, it } from 'vitest';
import { computeDebtorFifoMetrics } from '../persona-debtors.engine';

describe('persona-debtors.engine (Motor Puro FIFO con Decimal.js)', () => {
  it('devuelve métricas en cero cuando el saldo pendiente es cero o acreedor (negativo)', () => {
    const zeroBalance = computeDebtorFifoMetrics({
      outstandingBalance: 0,
      orders: [
        {
          id: 1,
          billingType: 'OFFICIAL',
          totalAmount: 15000,
          directIncomeSum: 0,
          directCreditNoteSum: 0,
        },
      ],
      unallocatedOfficialCredit: 0,
      unallocatedInternalCredit: 0,
    });

    expect(zeroBalance).toMatchObject({
      outstandingBalance: 0,
      debtA: 0,
      debtX: 0,
      pendingInvoicesCount: 0,
      hasMultiplePendingInvoices: false,
      needsFollowUp: false,
      followUpLabel: null,
    });

    const negativeBalance = computeDebtorFifoMetrics({
      outstandingBalance: -1500.4,
      orders: [],
      unallocatedOfficialCredit: 0,
      unallocatedInternalCredit: 0,
    });

    expect(negativeBalance).toMatchObject({
      outstandingBalance: 0,
      debtA: 0,
      debtX: 0,
      pendingInvoicesCount: 0,
      hasMultiplePendingInvoices: false,
      needsFollowUp: false,
      followUpLabel: null,
    });
  });

  it('aplica FIFO cronológico por sucursal independiente (OFFICIAL vs INTERNAL)', () => {
    const result = computeDebtorFifoMetrics({
      outstandingBalance: 25000,
      orders: [
        {
          id: 10,
          billingType: 'OFFICIAL',
          totalAmount: 10000,
          directIncomeSum: 0,
          directCreditNoteSum: 0,
        },
        {
          id: 11,
          billingType: 'OFFICIAL',
          totalAmount: 15000,
          directIncomeSum: 0,
          directCreditNoteSum: 0,
        },
        {
          id: 12,
          billingType: 'INTERNAL',
          totalAmount: 10000,
          directIncomeSum: 0,
          directCreditNoteSum: 0,
        },
      ],
      // Cancela completamente el pedido #10 ($10.000) y deja saldo completo en #11 ($15.000)
      unallocatedOfficialCredit: 10000,
      // El crédito interno no tiene más pedidos que saldar con exceso y no toca #11 OFFICIAL
      unallocatedInternalCredit: 0,
    });

    expect(result.outstandingBalance).toBe(25000);
    expect(result.debtA).toBe(15000);
    expect(result.debtX).toBe(10000);
    expect(result.pendingInvoicesCount).toBe(2);
    expect(result.hasMultiplePendingInvoices).toBe(true);
    expect(result.debtA + result.debtX).toBe(result.outstandingBalance);
  });

  it('descuenta cobros directos y notas de crédito aprobadas aplicando umbral > 0.5', () => {
    const result = computeDebtorFifoMetrics({
      outstandingBalance: 8500,
      orders: [
        {
          id: 21,
          billingType: 'INTERNAL',
          totalAmount: 10000,
          directIncomeSum: 7000,
          directCreditNoteSum: 2999.6, // deuda restante 0.4 <= 0.5 => saldada
        },
        {
          id: 22,
          billingType: 'INTERNAL',
          totalAmount: 8500,
          directIncomeSum: 0,
          directCreditNoteSum: 0,
        },
      ],
      unallocatedOfficialCredit: 0,
      unallocatedInternalCredit: 0,
    });

    expect(result.pendingInvoicesCount).toBe(1);
    expect(result.hasMultiplePendingInvoices).toBe(false);
    expect(result.debtA).toBe(0);
    expect(result.debtX).toBe(8500);
  });

  it('garantiza invariante debtA + debtX === roundToIntegerPeso(outstandingBalance) sin deriva Float', () => {
    // Caso propenso a deriva IEEE-754: 1/3 y 2/3 sobre saldo con decimales .5 (ROUND_HALF_UP)
    const result = computeDebtorFifoMetrics({
      outstandingBalance: '10000.50',
      orders: [
        {
          id: 31,
          billingType: 'OFFICIAL',
          totalAmount: '100.10',
          directIncomeSum: 0,
          directCreditNoteSum: 0,
        },
        {
          id: 32,
          billingType: 'INTERNAL',
          totalAmount: '200.20',
          directIncomeSum: 0,
          directCreditNoteSum: 0,
        },
      ],
      unallocatedOfficialCredit: 0,
      unallocatedInternalCredit: 0,
    });

    expect(result.outstandingBalance).toBe(10001);
    expect(result.debtA).toBe(3334);
    expect(result.debtX).toBe(6667);
    expect(result.debtA + result.debtX).toBe(result.outstandingBalance);
  });

  describe('clasificación automática estilo fibrón/lapicera (boletas redondas, restos y atrasos > 10 días)', () => {
    const refDate = new Date('2026-11-24T15:00:00-03:00');

    it('NO marca reclamo cuando debe 1 sola boleta redonda reciente (<= 10 días)', () => {
      const result = computeDebtorFifoMetrics({
        outstandingBalance: 171220,
        referenceDate: refDate,
        orders: [
          {
            id: 100,
            billingType: 'OFFICIAL',
            totalAmount: 171220,
            directIncomeSum: 0,
            directCreditNoteSum: 0,
            date: '2026-11-18T12:00:00-03:00', // 6 días
          },
        ],
        unallocatedOfficialCredit: 0,
        unallocatedInternalCredit: 0,
      });

      expect(result.needsFollowUp).toBe(false);
      expect(result.followUpLabel).toBeNull();
      expect(result.branchA.followUpReason).toBe('CURRENT');
      expect(result.branchA.oldestPendingDays).toBe(6);
    });

    it('marca "2 viajes" y "4 viajes" cuando debe más de 1 viaje redondo en la misma sucursal', () => {
      const twoFull = computeDebtorFifoMetrics({
        outstandingBalance: 372717,
        referenceDate: refDate,
        orders: [
          {
            id: 1,
            billingType: 'OFFICIAL',
            totalAmount: 200000,
            directIncomeSum: 0,
            directCreditNoteSum: 0,
            date: '2026-11-16T10:00:00-03:00',
          },
          {
            id: 2,
            billingType: 'OFFICIAL',
            totalAmount: 172717,
            directIncomeSum: 0,
            directCreditNoteSum: 0,
            date: '2026-11-23T10:00:00-03:00',
          },
        ],
        unallocatedOfficialCredit: 0,
        unallocatedInternalCredit: 0,
      });

      expect(twoFull.needsFollowUp).toBe(true);
      expect(twoFull.followUpLabel).toBe('2 viajes');
      expect(twoFull.branchA.followUpReason).toBe('MULTIPLE_FULL');
      expect(twoFull.branchA.fullPendingCount).toBe(2);

      const fourFull = computeDebtorFifoMetrics({
        outstandingBalance: 3746623,
        referenceDate: refDate,
        orders: [
          { id: 1, billingType: 'OFFICIAL', totalAmount: 900000, directIncomeSum: 0, directCreditNoteSum: 0, date: '2026-11-03T10:00:00-03:00' },
          { id: 2, billingType: 'OFFICIAL', totalAmount: 900000, directIncomeSum: 0, directCreditNoteSum: 0, date: '2026-11-10T10:00:00-03:00' },
          { id: 3, billingType: 'OFFICIAL', totalAmount: 900000, directIncomeSum: 0, directCreditNoteSum: 0, date: '2026-11-17T10:00:00-03:00' },
          { id: 4, billingType: 'OFFICIAL', totalAmount: 1046623, directIncomeSum: 0, directCreditNoteSum: 0, date: '2026-11-24T10:00:00-03:00' },
        ],
        unallocatedOfficialCredit: 0,
        unallocatedInternalCredit: 0,
      });

      expect(fourFull.needsFollowUp).toBe(true);
      expect(fourFull.followUpLabel).toBe('4 viajes');
    });

    it('marca "1 + resto 12/11" y "2 + resto 5/11" cuando quedó resto parcial + viajes nuevos', () => {
      const restoAndLast = computeDebtorFifoMetrics({
        outstandingBalance: 529075,
        referenceDate: refDate,
        orders: [
          {
            id: 1,
            billingType: 'INTERNAL',
            totalAmount: 300000,
            directIncomeSum: 0,
            directCreditNoteSum: 0,
            date: '2026-11-12T10:00:00-03:00',
          },
          {
            id: 2,
            billingType: 'INTERNAL',
            totalAmount: 329075,
            directIncomeSum: 0,
            directCreditNoteSum: 0,
            date: '2026-11-19T10:00:00-03:00',
          },
        ],
        unallocatedOfficialCredit: 0,
        unallocatedInternalCredit: 100000, // paga parcial la del 12/11 -> queda resto 200.000
      });

      expect(restoAndLast.needsFollowUp).toBe(true);
      expect(restoAndLast.followUpLabel).toBe('1 + resto 12/11');
      expect(restoAndLast.branchX.followUpReason).toBe('PARTIAL_AND_MORE');
      expect(restoAndLast.branchX.hasPartialRemainder).toBe(true);

      const restoAndTwo = computeDebtorFifoMetrics({
        outstandingBalance: 770927,
        referenceDate: refDate,
        orders: [
          { id: 1, billingType: 'OFFICIAL', totalAmount: 300000, directIncomeSum: 200000, directCreditNoteSum: 0, date: '2026-11-05T10:00:00-03:00' },
          { id: 2, billingType: 'OFFICIAL', totalAmount: 350000, directIncomeSum: 0, directCreditNoteSum: 0, date: '2026-11-12T10:00:00-03:00' },
          { id: 3, billingType: 'OFFICIAL', totalAmount: 320927, directIncomeSum: 0, directCreditNoteSum: 0, date: '2026-11-19T10:00:00-03:00' },
        ],
        unallocatedOfficialCredit: 0,
        unallocatedInternalCredit: 0,
      });

      expect(restoAndTwo.needsFollowUp).toBe(true);
      expect(restoAndTwo.followUpLabel).toBe('2 + resto 5/11');
    });

    it('marca "Resto 5/11" cuando solo quedó un resto impago', () => {
      const onlyResto = computeDebtorFifoMetrics({
        outstandingBalance: 87656,
        referenceDate: refDate,
        orders: [
          {
            id: 1,
            billingType: 'INTERNAL',
            totalAmount: 200000,
            directIncomeSum: 112344,
            directCreditNoteSum: 0,
            date: '2026-11-05T11:00:00-03:00',
          },
        ],
        unallocatedOfficialCredit: 0,
        unallocatedInternalCredit: 0,
      });

      expect(onlyResto.needsFollowUp).toBe(true);
      expect(onlyResto.followUpLabel).toBe('Resto 5/11');
      expect(onlyResto.branchX.followUpReason).toBe('PARTIAL_REMAINDER');
    });

    it('marca fecha (ej. "13/11") cuando debe 1 sola boleta redonda pero supera los 10 días', () => {
      const overdue11Days = computeDebtorFifoMetrics({
        outstandingBalance: 197683,
        referenceDate: refDate,
        orders: [
          {
            id: 1,
            billingType: 'OFFICIAL',
            totalAmount: 197683,
            directIncomeSum: 0,
            directCreditNoteSum: 0,
            date: '2026-11-13T10:00:00-03:00', // 11 días > 10
          },
        ],
        unallocatedOfficialCredit: 0,
        unallocatedInternalCredit: 0,
      });

      expect(overdue11Days.needsFollowUp).toBe(true);
      expect(overdue11Days.followUpLabel).toBe('13/11');
      expect(overdue11Days.branchA.followUpReason).toBe('OVERDUE_SINGLE');
      expect(overdue11Days.branchA.oldestPendingDays).toBe(11);

      const exact10Days = computeDebtorFifoMetrics({
        outstandingBalance: 197683,
        referenceDate: refDate,
        orders: [
          {
            id: 1,
            billingType: 'OFFICIAL',
            totalAmount: 197683,
            directIncomeSum: 0,
            directCreditNoteSum: 0,
            date: '2026-11-14T10:00:00-03:00', // 10 días === umbral -> no marca
          },
        ],
        unallocatedOfficialCredit: 0,
        unallocatedInternalCredit: 0,
      });

      expect(exact10Days.needsFollowUp).toBe(false);
      expect(exact10Days.followUpLabel).toBeNull();
    });

    it('evalúa Sucursal A y X independientemente (no genera falso positivo por entrega dividida A+X reciente)', () => {
      const splitRecent = computeDebtorFifoMetrics({
        outstandingBalance: 250000,
        referenceDate: refDate,
        orders: [
          { id: 1, billingType: 'OFFICIAL', totalAmount: 150000, directIncomeSum: 0, directCreditNoteSum: 0, date: '2026-11-20T10:00:00-03:00' },
          { id: 2, billingType: 'INTERNAL', totalAmount: 100000, directIncomeSum: 0, directCreditNoteSum: 0, date: '2026-11-20T10:00:00-03:00' },
        ],
        unallocatedOfficialCredit: 0,
        unallocatedInternalCredit: 0,
      });

      expect(splitRecent.needsFollowUp).toBe(false);
      expect(splitRecent.followUpLabel).toBeNull();
      expect(splitRecent.branchA.needsFollowUp).toBe(false);
      expect(splitRecent.branchX.needsFollowUp).toBe(false);

      const bothBranchesFlagged = computeDebtorFifoMetrics({
        outstandingBalance: 1000000,
        referenceDate: refDate,
        orders: [
          { id: 1, billingType: 'OFFICIAL', totalAmount: 200000, directIncomeSum: 0, directCreditNoteSum: 0, date: '2026-11-10T10:00:00-03:00' },
          { id: 2, billingType: 'OFFICIAL', totalAmount: 300000, directIncomeSum: 0, directCreditNoteSum: 0, date: '2026-11-17T10:00:00-03:00' },
          { id: 3, billingType: 'INTERNAL', totalAmount: 300000, directIncomeSum: 100000, directCreditNoteSum: 0, date: '2026-11-12T10:00:00-03:00' },
          { id: 4, billingType: 'INTERNAL', totalAmount: 300000, directIncomeSum: 0, directCreditNoteSum: 0, date: '2026-11-19T10:00:00-03:00' },
        ],
        unallocatedOfficialCredit: 0,
        unallocatedInternalCredit: 0,
      });

      expect(bothBranchesFlagged.needsFollowUp).toBe(true);
      expect(bothBranchesFlagged.branchA.followUpLabel).toBe('2 viajes');
      expect(bothBranchesFlagged.branchX.followUpLabel).toBe('1 + resto 12/11');
      expect(bothBranchesFlagged.followUpLabel).toBe('A: 2 viajes · X: 1 + resto 12/11');
    });

    it('respeta saldos iniciales (OPENING_BALANCE) por sucursal A y X incluso sin pedidos previos y absorbe pagos a cuenta FIFO', () => {
      const onlyOpeningA = computeDebtorFifoMetrics({
        outstandingBalance: 1329582,
        orders: [],
        unallocatedOfficialCredit: 0,
        unallocatedInternalCredit: 0,
        openingOfficialDebt: 1329582,
        openingInternalDebt: 0,
      });
      expect(onlyOpeningA.debtA).toBe(1329582);
      expect(onlyOpeningA.debtX).toBe(0);

      const openingAWithPartialPaymentAndNewOrderX = computeDebtorFifoMetrics({
        outstandingBalance: 1079582,
        orders: [
          { id: 10, billingType: 'INTERNAL', totalAmount: 50000, directIncomeSum: 0, directCreditNoteSum: 0, date: '2026-11-25T10:00:00-03:00' },
        ],
        unallocatedOfficialCredit: 300000,
        unallocatedInternalCredit: 0,
        openingOfficialDebt: 1329582,
        openingInternalDebt: 0,
      });
      expect(openingAWithPartialPaymentAndNewOrderX.debtA).toBe(1029582);
      expect(openingAWithPartialPaymentAndNewOrderX.debtX).toBe(50000);
      expect(openingAWithPartialPaymentAndNewOrderX.debtA + openingAWithPartialPaymentAndNewOrderX.debtX).toBe(1079582);
    });

    it('descuenta boletas históricas de Iduo ya pagadas antes del corte usando el OPENING_BALANCE real (caso Utello)', () => {
      const refNov27 = new Date('2026-11-27T18:00:00-03:00');
      const utello = computeDebtorFifoMetrics({
        outstandingBalance: 558146,
        referenceDate: refNov27,
        openingOfficialDebt: 0,
        openingInternalDebt: 558146,
        unallocatedOfficialCredit: 0,
        unallocatedInternalCredit: 0,
        orders: [
          { id: 615, billingType: 'INTERNAL', totalAmount: 445772.27, directIncomeSum: 0, directCreditNoteSum: 0, date: '2026-11-03T15:00:00Z', isHistorical: true },
          { id: 483, billingType: 'INTERNAL', totalAmount: 1351560, directIncomeSum: 0, directCreditNoteSum: 0, date: '2026-11-03T15:00:00Z', isHistorical: true },
          { id: 112, billingType: 'INTERNAL', totalAmount: 95952, directIncomeSum: 0, directCreditNoteSum: 0, date: '2026-11-07T15:00:00Z', isHistorical: true },
          { id: 352, billingType: 'INTERNAL', totalAmount: 772980, directIncomeSum: 0, directCreditNoteSum: 0, date: '2026-11-10T15:00:00Z', isHistorical: true },
          { id: 126, billingType: 'INTERNAL', totalAmount: 257042.24, directIncomeSum: 0, directCreditNoteSum: 0, date: '2026-11-17T15:00:00Z', isHistorical: true },
          { id: 130, billingType: 'INTERNAL', totalAmount: 558146.28, directIncomeSum: 0, directCreditNoteSum: 0, date: '2026-11-24T15:00:00Z', isHistorical: true },
        ],
      });

      expect(utello.debtA).toBe(0);
      expect(utello.debtX).toBe(558146);
      expect(utello.pendingInvoicesCount).toBe(1);
      expect(utello.hasMultiplePendingInvoices).toBe(false);
      expect(utello.needsFollowUp).toBe(false);
      expect(utello.followUpLabel).toBeNull();
      expect(utello.branchX.followUpReason).toBe('CURRENT');

      // Si realmente debe los últimos 2 viajes del historial Iduo, marca "2 viajes"
      const owesLastTwo = computeDebtorFifoMetrics({
        outstandingBalance: 815188,
        referenceDate: refNov27,
        openingOfficialDebt: 0,
        openingInternalDebt: 815188,
        unallocatedOfficialCredit: 0,
        unallocatedInternalCredit: 0,
        orders: [
          { id: 112, billingType: 'INTERNAL', totalAmount: 95952, directIncomeSum: 0, directCreditNoteSum: 0, date: '2026-11-07T15:00:00Z', isHistorical: true },
          { id: 126, billingType: 'INTERNAL', totalAmount: 257042.24, directIncomeSum: 0, directCreditNoteSum: 0, date: '2026-11-17T15:00:00Z', isHistorical: true },
          { id: 130, billingType: 'INTERNAL', totalAmount: 558146.28, directIncomeSum: 0, directCreditNoteSum: 0, date: '2026-11-24T15:00:00Z', isHistorical: true },
        ],
      });
      expect(owesLastTwo.pendingInvoicesCount).toBe(2);
      expect(owesLastTwo.needsFollowUp).toBe(true);
      expect(owesLastTwo.followUpLabel).toBe('2 viajes');

      // Si luego se suma un pedido nuevo en Kilate sin pagar el anterior, marca "2 viajes"
      const withNewKilateOrder = computeDebtorFifoMetrics({
        outstandingBalance: 858146,
        referenceDate: refNov27,
        openingOfficialDebt: 0,
        openingInternalDebt: 558146,
        unallocatedOfficialCredit: 0,
        unallocatedInternalCredit: 0,
        orders: [
          { id: 126, billingType: 'INTERNAL', totalAmount: 257042.24, directIncomeSum: 0, directCreditNoteSum: 0, date: '2026-11-17T15:00:00Z', isHistorical: true },
          { id: 130, billingType: 'INTERNAL', totalAmount: 558146.28, directIncomeSum: 0, directCreditNoteSum: 0, date: '2026-11-24T15:00:00Z', isHistorical: true },
          { id: 900, billingType: 'INTERNAL', totalAmount: 300000, directIncomeSum: 0, directCreditNoteSum: 0, date: '2026-11-27T15:00:00Z', isHistorical: false },
        ],
      });
      expect(withNewKilateOrder.pendingInvoicesCount).toBe(2);
      expect(withNewKilateOrder.followUpLabel).toBe('2 viajes');
    });

    it('agrupa múltiples facturas del mismo día como 1 solo viaje (caso real MARTINEZ LUCAS)', () => {
      const refNov27 = new Date('2026-11-27T23:00:00-03:00');
      const martinez = computeDebtorFifoMetrics({
        outstandingBalance: 575569,
        referenceDate: refNov27,
        openingOfficialDebt: 0,
        openingInternalDebt: 575569,
        unallocatedOfficialCredit: 0,
        unallocatedInternalCredit: 0,
        orders: [
          { id: 1990, billingType: 'INTERNAL', totalAmount: '471051.11', directIncomeSum: 0, directCreditNoteSum: 0, date: '2026-10-15T15:00:00Z', isHistorical: true },
          { id: 3605, billingType: 'INTERNAL', totalAmount: '35592', directIncomeSum: 0, directCreditNoteSum: 0, date: '2026-10-15T15:00:00Z', isHistorical: true },
          { id: 2599, billingType: 'INTERNAL', totalAmount: '18598', directIncomeSum: 0, directCreditNoteSum: 0, date: '2026-10-26T15:00:00Z', isHistorical: true },
          { id: 1814, billingType: 'INTERNAL', totalAmount: '611733.63', directIncomeSum: 0, directCreditNoteSum: 0, date: '2026-10-28T15:00:00Z', isHistorical: true },
          { id: 1175, billingType: 'INTERNAL', totalAmount: '22910', directIncomeSum: 0, directCreditNoteSum: 0, date: '2026-11-25T15:00:00Z', isHistorical: true },
          { id: 1012, billingType: 'INTERNAL', totalAmount: '394664.66', directIncomeSum: 0, directCreditNoteSum: 0, date: '2026-11-26T15:00:00Z', isHistorical: true },
          { id: 1182, billingType: 'INTERNAL', totalAmount: '40512', directIncomeSum: 0, directCreditNoteSum: 0, date: '2026-11-26T15:00:00Z', isHistorical: true },
        ],
      });

      expect(martinez.debtA).toBe(0);
      expect(martinez.debtX).toBe(575569);
      expect(martinez.branchX.pendingCount).toBe(3);
      expect(martinez.branchX.fullPendingCount).toBe(2);
      expect(martinez.branchX.hasPartialRemainder).toBe(true);
      expect(martinez.branchX.oldestPendingShortDate).toBe('28/10');
      expect(martinez.needsFollowUp).toBe(true);
      expect(martinez.followUpLabel).toBe('2 + resto 28/10');
    });

    it('cuenta 2 facturas del mismo día como 1 solo viaje (sin marca si es reciente, y "Resto" si tuvo pago parcial)', () => {
      const sameDayRecent = computeDebtorFifoMetrics({
        outstandingBalance: 150000,
        referenceDate: refDate,
        orders: [
          { id: 1, billingType: 'INTERNAL', totalAmount: 100000, directIncomeSum: 0, directCreditNoteSum: 0, date: '2026-11-20T10:00:00-03:00' },
          { id: 2, billingType: 'INTERNAL', totalAmount: 50000, directIncomeSum: 0, directCreditNoteSum: 0, date: '2026-11-20T14:00:00-03:00' },
        ],
        unallocatedOfficialCredit: 0,
        unallocatedInternalCredit: 0,
      });

      expect(sameDayRecent.pendingInvoicesCount).toBe(1);
      expect(sameDayRecent.needsFollowUp).toBe(false);
      expect(sameDayRecent.followUpLabel).toBeNull();
      expect(sameDayRecent.branchX.followUpReason).toBe('CURRENT');

      const sameDayPartial = computeDebtorFifoMetrics({
        outstandingBalance: 100000,
        referenceDate: refDate,
        orders: [
          { id: 1, billingType: 'INTERNAL', totalAmount: 100000, directIncomeSum: 0, directCreditNoteSum: 0, date: '2026-11-20T10:00:00-03:00' },
          { id: 2, billingType: 'INTERNAL', totalAmount: 50000, directIncomeSum: 50000, directCreditNoteSum: 0, date: '2026-11-20T14:00:00-03:00' },
        ],
        unallocatedOfficialCredit: 0,
        unallocatedInternalCredit: 0,
      });

      expect(sameDayPartial.pendingInvoicesCount).toBe(1);
      expect(sameDayPartial.needsFollowUp).toBe(true);
      expect(sameDayPartial.followUpLabel).toBe('Resto 20/11');
      expect(sameDayPartial.branchX.followUpReason).toBe('PARTIAL_REMAINDER');
    });

    it('marca "Saldo ant." o "N + saldo ant." cuando el saldo inicial supera al historial importado', () => {
      const onlyOldDebt = computeDebtorFifoMetrics({
        outstandingBalance: 1401206,
        referenceDate: refDate,
        openingOfficialDebt: 0,
        openingInternalDebt: 1401206,
        unallocatedOfficialCredit: 0,
        unallocatedInternalCredit: 0,
        orders: [],
      });

      expect(onlyOldDebt.pendingInvoicesCount).toBe(1);
      expect(onlyOldDebt.needsFollowUp).toBe(true);
      expect(onlyOldDebt.followUpLabel).toBe('Saldo ant.');

      const oldDebtPlusTwoTrips = computeDebtorFifoMetrics({
        outstandingBalance: 400000,
        referenceDate: refDate,
        openingOfficialDebt: 0,
        openingInternalDebt: 300000,
        unallocatedOfficialCredit: 0,
        unallocatedInternalCredit: 0,
        orders: [
          { id: 1, billingType: 'INTERNAL', totalAmount: 100000, directIncomeSum: 0, directCreditNoteSum: 0, date: '2026-11-10T10:00:00-03:00', isHistorical: true },
          { id: 2, billingType: 'INTERNAL', totalAmount: 100000, directIncomeSum: 0, directCreditNoteSum: 0, date: '2026-11-18T10:00:00-03:00', isHistorical: false },
        ],
      });

      expect(oldDebtPlusTwoTrips.pendingInvoicesCount).toBe(3);
      expect(oldDebtPlusTwoTrips.needsFollowUp).toBe(true);
      expect(oldDebtPlusTwoTrips.followUpLabel).toBe('2 + saldo ant.');
    });

    it('detecta factura anterior impaga cuando el cliente pagó la última (caso real BERNETCHE ANTONELLA)', () => {
      const refNov28 = new Date('2026-11-28T10:00:00-03:00');
      const bernetche = computeDebtorFifoMetrics({
        outstandingBalance: 134993,
        referenceDate: refNov28,
        openingOfficialDebt: 0,
        openingInternalDebt: 134993,
        unallocatedOfficialCredit: 0,
        unallocatedInternalCredit: 0,
        orders: [
          { id: 762, billingType: 'INTERNAL', totalAmount: 234676, directIncomeSum: 0, directCreditNoteSum: 0, date: '2026-11-09T15:00:00Z', isHistorical: true },
          { id: 415, billingType: 'INTERNAL', totalAmount: 134993, directIncomeSum: 0, directCreditNoteSum: 0, date: '2026-11-16T15:00:00Z', isHistorical: true },
          { id: 578, billingType: 'INTERNAL', totalAmount: 251141, directIncomeSum: 0, directCreditNoteSum: 0, date: '2026-11-24T15:00:00Z', isHistorical: true },
        ],
      });

      expect(bernetche.pendingInvoicesCount).toBe(1);
      expect(bernetche.needsFollowUp).toBe(true);
      expect(bernetche.followUpLabel).toBe('16/11');
      expect(bernetche.branchX.followUpReason).toBe('OVERDUE_SINGLE');
      expect(bernetche.branchX.hasPartialRemainder).toBe(false);
      expect(bernetche.branchX.oldestPendingShortDate).toBe('16/11');
      expect(bernetche.branchX.oldestPendingDays).toBe(12);

      // Incluso si la factura anterior salteada tiene <= 10 días (ej. 7 días), marca la fecha
      const skippedRecent = computeDebtorFifoMetrics({
        outstandingBalance: 150000,
        referenceDate: refNov28,
        orders: [
          { id: 1, billingType: 'INTERNAL', totalAmount: 150000, directIncomeSum: 0, directCreditNoteSum: 0, date: '2026-11-21T15:00:00Z' },
          { id: 2, billingType: 'INTERNAL', totalAmount: 220000, directIncomeSum: 0, directCreditNoteSum: 0, date: '2026-11-28T10:00:00-03:00' },
        ],
        unallocatedOfficialCredit: 0,
        unallocatedInternalCredit: 220000,
      });

      expect(skippedRecent.needsFollowUp).toBe(true);
      expect(skippedRecent.followUpLabel).toBe('21/11');
      expect(skippedRecent.branchX.followUpReason).toBe('OVERDUE_SINGLE');

      // Cuando debe la última + una anterior salteada (ej. pagó la del medio), marca "2 viajes"
      const skippedPlusLatest = computeDebtorFifoMetrics({
        outstandingBalance: 503252,
        referenceDate: refNov28,
        openingOfficialDebt: 503252,
        openingInternalDebt: 0,
        unallocatedOfficialCredit: 0,
        unallocatedInternalCredit: 0,
        orders: [
          { id: 1157, billingType: 'OFFICIAL', totalAmount: '256859.33', directIncomeSum: 0, directCreditNoteSum: 0, date: '2026-11-13T15:00:00Z', isHistorical: true },
          { id: 258, billingType: 'OFFICIAL', totalAmount: '385168.06', directIncomeSum: 0, directCreditNoteSum: 0, date: '2026-11-19T15:00:00Z', isHistorical: true },
          { id: 1131, billingType: 'OFFICIAL', totalAmount: '246392.98', directIncomeSum: 0, directCreditNoteSum: 0, date: '2026-11-27T15:00:00Z', isHistorical: true },
        ],
      });

      expect(skippedPlusLatest.needsFollowUp).toBe(true);
      expect(skippedPlusLatest.followUpLabel).toBe('2 viajes');
      expect(skippedPlusLatest.branchA.followUpReason).toBe('MULTIPLE_FULL');
      expect(skippedPlusLatest.branchA.oldestPendingShortDate).toBe('13/11');
    });
  });
});
