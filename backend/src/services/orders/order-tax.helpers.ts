import prisma from '../../utils/prisma';
import { InvoiceType, BillingType, LedgerEntryType, LedgerSourceType } from '@prisma/client';
import {
  roundToIntegerPeso,
  roundToTwoDecimals,
  toDecimal,
} from '../../core/money';
import { recordLedgerMovement } from '../ledger/account-ledger.service';
import { paymentAllocationService } from '../finance/payment-allocation.service';

export function getJurisdictionCode(provinceOrAddress?: string | null): string {
  if (!provinceOrAddress) return 'AR-B';
  const p = provinceOrAddress.toLowerCase();
  if (p.includes('misiones')) return 'AR-N';
  if (p.includes('corrientes')) return 'AR-W';
  if (p.includes('caba') || p.includes('capital') || p.includes('ciudad aut')) return 'AR-C';
  if (p.includes('buenos aires') || p.includes('bs')) return 'AR-B';
  return 'AR-B';
}

export type ResolvedTaxCondition =
  | 'RESPONSABLE_INSCRIPTO'
  | 'MONOTRIBUTO'
  | 'EXENTO'
  | 'CONSUMIDOR_FINAL';

export function resolvePersonaTaxCondition(persona?: {
  cuit?: string | null;
  taxCondition?: string | null;
} | null): ResolvedTaxCondition {
  const raw = String(persona?.taxCondition || '').trim().toUpperCase();
  if (
    raw === 'RESPONSABLE_INSCRIPTO' ||
    raw === 'MONOTRIBUTO' ||
    raw === 'EXENTO' ||
    raw === 'CONSUMIDOR_FINAL'
  ) {
    return raw;
  }
  const cuitLimpio = persona?.cuit ? persona.cuit.replace(/\D/g, '') : '';
  return cuitLimpio.length === 11 ? 'RESPONSABLE_INSCRIPTO' : 'CONSUMIDOR_FINAL';
}

export interface AfipOrderTaxBreakdown {
  net: number;
  tax: number;
  percepIIBB: number;
  percepIVA: number;
  finalTotal: number;
  finalInvoiceType: InvoiceType;
  docType: number;
  cuitLimpio: string;
  isFacturaAOfficial: boolean;
  taxCondition: ResolvedTaxCondition;
}

/**
 * Calcula con Decimal.js el desglose fiscal interno para AFIP/ARCA o Presupuesto.
 * Garantiza que Neto + IVA + Percepciones === Total al centavo exacto (ROUND_HALF_UP).
 * Regla RG 5329 (Percepción IVA 3%): aplica únicamente a Factura A oficial emitida a
 * Responsable Inscripto cuando el Neto Gravado supera $100.000 (mínimo no imponible $3.000).
 */
export async function computeInvoiceTaxBreakdown(
  baseCommercialTotal: number,
  billingType: BillingType,
  persona: { cuit?: string | null; iibbAliquot?: any; taxCondition?: string | null },
): Promise<AfipOrderTaxBreakdown> {
  const cuitLimpio = persona.cuit ? persona.cuit.replace(/\D/g, '') : '';
  const taxCondition = resolvePersonaTaxCondition(persona);
  let docType = 99;
  let finalInvoiceType: InvoiceType = InvoiceType.PRESUPUESTO;

  if (billingType === BillingType.OFFICIAL) {
    if (cuitLimpio.length === 11) {
      docType = 80;
      finalInvoiceType =
        taxCondition === 'EXENTO' || taxCondition === 'CONSUMIDOR_FINAL'
          ? InvoiceType.FACTURA_B
          : InvoiceType.FACTURA_A;
    } else if (cuitLimpio.length === 7 || cuitLimpio.length === 8) {
      docType = 96;
      finalInvoiceType = InvoiceType.FACTURA_B;
    } else {
      finalInvoiceType = InvoiceType.FACTURA_B;
    }
  }

  const totalBaseDec = roundToTwoDecimals(roundToIntegerPeso(baseCommercialTotal));
  const netDec = roundToTwoDecimals(totalBaseDec.dividedBy('1.21'));
  const taxDec = roundToTwoDecimals(totalBaseDec.minus(netDec));

  let percepIIBBDec = toDecimal(0);
  let percepIVADec = toDecimal(0);
  let finalTotalDec = totalBaseDec;

  const isFacturaAOfficial =
    billingType === BillingType.OFFICIAL && finalInvoiceType === InvoiceType.FACTURA_A;

  if (isFacturaAOfficial) {
    const perceptionIVA = await prisma.perceptionType.findUnique({
      where: { code: 'IVA_5329' },
    });

    const isResponsableInscripto = taxCondition === 'RESPONSABLE_INSCRIPTO';
    const applyIvaPerc = isResponsableInscripto && netDec.greaterThan(100000);
    const ivaPercAliquot = applyIvaPerc
      ? perceptionIVA && perceptionIVA.aliquot
        ? toDecimal(perceptionIVA.aliquot.toString())
        : toDecimal(3)
      : toDecimal(0);
    const iibbAliquot = toDecimal(persona.iibbAliquot ? persona.iibbAliquot.toString() : 0);

    percepIIBBDec = roundToTwoDecimals(netDec.times(iibbAliquot).dividedBy(100));
    percepIVADec = roundToTwoDecimals(netDec.times(ivaPercAliquot).dividedBy(100));
    finalTotalDec = roundToTwoDecimals(
      netDec.plus(taxDec).plus(percepIIBBDec).plus(percepIVADec),
    );
  }

  return {
    net: netDec.toNumber(),
    tax: taxDec.toNumber(),
    percepIIBB: percepIIBBDec.toNumber(),
    percepIVA: percepIVADec.toNumber(),
    finalTotal: finalTotalDec.toNumber(),
    finalInvoiceType,
    docType,
    cuitLimpio,
    isFacturaAOfficial,
    taxCondition,
  };
}

/**
 * Registra cobro en caja/banco o incrementa saldo deudor en cuenta corriente.
 */
export async function settleOrderFinancials(
  tx: any,
  params: {
    orderId: number;
    personaId: number;
    adminId: number;
    billingType: BillingType;
    paymentMethod?: any;
    amount: number;
    invoiceTotal?: number;
    invoiceNumber?: string | null;
    description: string;
    cashDrawerId?: number;
    bankAccountId?: number;
  },
) {
  const {
    orderId,
    personaId,
    adminId,
    billingType,
    paymentMethod,
    amount,
    invoiceTotal,
    invoiceNumber,
    description,
    cashDrawerId,
    bankAccountId,
  } = params;

  const totalOrderAmount = roundToIntegerPeso(
    invoiceTotal !== undefined ? invoiceTotal : amount,
  ).toNumber();
  const settledPaymentAmount = roundToIntegerPeso(amount).toNumber();
  const formattedInv = invoiceNumber || `INT-${orderId.toString().padStart(5, '0')}`;

  await recordLedgerMovement(tx, {
    personaId,
    entryType: LedgerEntryType.DEBIT,
    sourceType: LedgerSourceType.ORDER_INVOICE,
    billingType,
    amount: totalOrderAmount,
    orderId,
    userId: adminId,
    reference: `Pedido #${orderId}`,
    description: `Factura ${formattedInv}`,
  });

  if (paymentMethod) {
    const isBankTransfer = paymentMethod === 'BANK_TRANSFER';
    const isEcheq = paymentMethod === 'CHECK' && /\(echeq\)|e-?cheq/i.test(description || '');

    const isVerifiedNow = !(isBankTransfer || isEcheq);
    const createdTx = await tx.transaction.create({
      data: {
        orderId,
        personaId,
        userId: adminId,
        billingType,
        type: 'INCOME',
        paymentMethod,
        amount: settledPaymentAmount,
        description,
        cashDrawerId,
        bankAccountId,
        verified: isVerifiedNow,
      },
    });

    if (isVerifiedNow && bankAccountId && typeof tx.bankAccount?.update === 'function') {
      await tx.bankAccount.update({
        where: { id: bankAccountId },
        data: { balance: { increment: settledPaymentAmount } },
      });
    }

    if (typeof tx.paymentAllocation?.createMany === 'function' && settledPaymentAmount > 0) {
      const directAmt = Math.min(settledPaymentAmount, Math.max(0, totalOrderAmount));
      if (directAmt > 0) {
        await tx.paymentAllocation.createMany({
          data: [{ transactionId: createdTx.id, orderId, amount: directAmt }],
          skipDuplicates: true,
        });
      }
      const overflow = roundToTwoDecimals(toDecimal(settledPaymentAmount).minus(directAmt)).toNumber();
      if (overflow > 0) {
        await paymentAllocationService.allocateTransactionToOrders(tx, {
          transactionId: createdTx.id,
          personaId,
          amount: overflow,
        });
      }
    }

    await recordLedgerMovement(tx, {
      personaId,
      entryType: LedgerEntryType.CREDIT,
      sourceType: LedgerSourceType.COLLECTION_RECEIPT,
      billingType,
      amount: settledPaymentAmount,
      orderId,
      transactionId: createdTx.id,
      userId: adminId,
      reference: `Recibo #${createdTx.id}`,
      description: description || `Cobro inmediato Factura ${formattedInv}`,
    });
  } else if (typeof tx.paymentAllocation?.createMany === 'function' && totalOrderAmount > 0) {
    await paymentAllocationService.applyAvailableCreditToOrder(tx, {
      orderId,
      personaId,
      orderTotal: totalOrderAmount,
    });
  }
}

/**
 * Resuelve la caja de efectivo o cuenta bancaria y registra el cobro en mostrador/caja o la deuda en cuenta corriente.
 */
export async function resolveAndSettleOrderPayment(
  tx: any,
  params: {
    orderId: number;
    personaId: number;
    adminId: number;
    userRole: string;
    billingType: BillingType;
    paymentMethod?: any;
    bankAccountId?: number;
    explicitCashDrawerId?: number;
    checkNumber?: string;
    checkIssuer?: string;
    checkAmount?: number;
    totalSum: number;
    invoiceNumber: string | null;
  },
) {
  const {
    orderId,
    personaId,
    adminId,
    userRole,
    billingType,
    paymentMethod,
    bankAccountId,
    explicitCashDrawerId,
    checkNumber,
    checkIssuer,
    checkAmount,
    totalSum,
    invoiceNumber,
  } = params;

  if (!paymentMethod) {
    await settleOrderFinancials(tx, {
      orderId,
      personaId,
      adminId,
      billingType,
      amount: totalSum,
      invoiceTotal: totalSum,
      invoiceNumber,
      description: '',
    });
    return;
  }

  let cashDrawerId: number | undefined;
  let bankAccountIdVal: number | undefined;
  let txAmount = totalSum;
  let txDescription = `Cobro en el acto de factura directa #${orderId} (${invoiceNumber})`;

  if (paymentMethod === 'CASH') {
    const activeDrawer = explicitCashDrawerId
      ? await tx.cashDrawer.findFirst({ where: { id: explicitCashDrawerId, status: 'OPEN' } })
      : (await tx.cashDrawer.findFirst({
          where: {
            status: 'OPEN',
            OR: [{ branch: 'DEPOSITO' }, { drawerType: 'DEPOSITO' }],
          },
          orderBy: { openedAt: 'desc' },
        })) ||
        (await tx.cashDrawer.findFirst({
          where: { userId: adminId, status: 'OPEN', drawerType: { not: 'CENTRAL' } },
          orderBy: { openedAt: 'desc' },
        })) ||
        (await tx.cashDrawer.findFirst({
          where: { status: 'OPEN', drawerType: { not: 'CENTRAL' } },
          orderBy: { openedAt: 'desc' },
        }));

    if (!activeDrawer) {
      throw new Error(
        'No hay una Caja Oficina abierta. Abrí la Caja Oficina antes de registrar cobros en efectivo.',
      );
    }
    cashDrawerId = activeDrawer.id;
  } else if (paymentMethod === 'BANK_TRANSFER') {
    const selectedBankId = bankAccountId
      ? Number(bankAccountId)
      : (await tx.bankAccount.findFirst())?.id;
    if (!selectedBankId) {
      throw new Error('No se encontró ninguna cuenta bancaria configurada en el sistema.');
    }
    bankAccountIdVal = selectedBankId;
  } else if (paymentMethod === 'CHECK') {
    if (bankAccountId) {
      bankAccountIdVal = Number(bankAccountId);
    } else {
      const isEcheq = /\(echeq\)|e-?cheq/i.test(String(checkIssuer || ''));
      if (isEcheq) {
        const allBanks = await tx.bankAccount.findMany();
        const preferred =
          allBanks.find((b: any) => /pcia|provincia/i.test(`${b.name || ''} ${b.bankName || ''}`)) ||
          allBanks.find((b: any) => !/^mp$/i.test(String(b.name || '').trim())) ||
          allBanks[0];
        bankAccountIdVal = preferred?.id;
      } else {
        const defaultBank = await tx.bankAccount.findFirst();
        bankAccountIdVal = defaultBank?.id;
      }
    }
    const cleanCheckNumber = checkNumber ? String(checkNumber).trim() : 'S/N';
    const cleanIssuer = checkIssuer ? String(checkIssuer).trim() : 'Desconocido';
    txAmount =
      checkAmount && !isNaN(Number(checkAmount)) && Number(checkAmount) > 0
        ? Number(checkAmount)
        : totalSum;
    txDescription = `Cheque N° ${cleanCheckNumber} (Emisor: ${cleanIssuer}) recibido en mostrador por factura #${orderId} (${invoiceNumber})`;
  }

  await settleOrderFinancials(tx, {
    orderId,
    personaId,
    adminId,
    billingType,
    paymentMethod,
    amount: txAmount,
    invoiceTotal: totalSum,
    invoiceNumber,
    description: txDescription,
    cashDrawerId,
    bankAccountId: bankAccountIdVal,
  });
}

/**
 * Registra percepciones de IIBB e IVA si corresponden.
 */
export async function recordInvoicePerceptions(
  tx: any,
  params: {
    personaId: number;
    invoiceNumber: string;
    percepIIBB: number;
    percepIVA: number;
    isFacturaAOfficial: boolean;
    provinceOrAddress?: string | null;
  },
) {
  const { personaId, invoiceNumber, percepIIBB, percepIVA, isFacturaAOfficial, provinceOrAddress } =
    params;

  if (percepIIBB > 0) {
    await tx.taxWithholding.create({
      data: {
        type: 'PERCEPCION_PRACTICADA',
        taxType: 'IIBB',
        personaId,
        number: invoiceNumber,
        date: new Date(),
        amount: isFacturaAOfficial
          ? roundToTwoDecimals(percepIIBB).toNumber()
          : roundToIntegerPeso(percepIIBB).toNumber(),
        jurisdiction: getJurisdictionCode(provinceOrAddress),
      },
    });
  }

  if (percepIVA > 0) {
    await tx.taxWithholding.create({
      data: {
        type: 'PERCEPCION_PRACTICADA',
        taxType: 'IVA',
        personaId,
        number: invoiceNumber,
        date: new Date(),
        amount: isFacturaAOfficial
          ? roundToTwoDecimals(percepIVA).toNumber()
          : roundToIntegerPeso(percepIVA).toNumber(),
        jurisdiction: null,
      },
    });
  }
}
