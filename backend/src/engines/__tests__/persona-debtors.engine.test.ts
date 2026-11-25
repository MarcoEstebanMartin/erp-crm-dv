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

    it('marca "Últimas 2" y "Últimas 4" cuando debe más de 1 boleta redonda en la misma sucursal', () => {
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
      expect(twoFull.followUpLabel).toBe('Últimas 2');
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
      expect(fourFull.followUpLabel).toBe('Últimas 4');
    });

    it('marca "Resto 12/11 y última" y "Resto 5/11 y últimas 2" cuando quedó resto parcial + boletas nuevas', () => {
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
      expect(restoAndLast.followUpLabel).toBe('Resto 12/11 y última');
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
      expect(restoAndTwo.followUpLabel).toBe('Resto 5/11 y últimas 2');
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
      expect(bothBranchesFlagged.branchA.followUpLabel).toBe('Últimas 2');
      expect(bothBranchesFlagged.branchX.followUpLabel).toBe('Resto 12/11 y última');
      expect(bothBranchesFlagged.followUpLabel).toBe('A: Últimas 2 · X: Resto 12/11 y última');
    });
  });
});
