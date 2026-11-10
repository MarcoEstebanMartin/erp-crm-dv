import prisma from '../../utils/prisma';
import { InvoiceType, BillingType } from '@prisma/client';
import {
  roundToIntegerPeso,
  roundToTwoDecimals,
  toDecimal,
} from '../../core/money';

export function getJurisdictionCode(provinceOrAddress?: string | null): string {
  if (!provinceOrAddress) return 'AR-B';
  const p = provinceOrAddress.toLowerCase();
  if (p.includes('misiones')) return 'AR-N';
  if (p.includes('corrientes')) return 'AR-W';
  if (p.includes('caba') || p.includes('capital') || p.includes('ciudad aut')) return 'AR-C';
  if (p.includes('buenos aires') || p.includes('bs')) return 'AR-B';
  return 'AR-B';
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
}

/**
 * Calcula con Decimal.js el desglose fiscal interno para AFIP/ARCA o Presupuesto.
 * Garantiza que Neto + IVA + Percepciones === Total al centavo exacto (ROUND_HALF_UP).
 */
export async function computeInvoiceTaxBreakdown(
  baseCommercialTotal: number,
  billingType: BillingType,
  persona: { cuit?: string | null; iibbAliquot?: any },
): Promise<AfipOrderTaxBreakdown> {
  const cuitLimpio = persona.cuit ? persona.cuit.replace(/-/g, '') : '';
  let docType = 99;
  let finalInvoiceType: InvoiceType = InvoiceType.PRESUPUESTO;

  if (billingType === BillingType.OFFICIAL) {
    if (cuitLimpio.length === 11) {
      docType = 80;
      finalInvoiceType = InvoiceType.FACTURA_A;
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

    const applyIvaPerc = totalBaseDec.greaterThan(100000);
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
    description,
    cashDrawerId,
    bankAccountId,
  } = params;

  if (paymentMethod) {
    if (paymentMethod === 'BANK_TRANSFER' && bankAccountId) {
      await tx.bankAccount.update({
        where: { id: bankAccountId },
        data: { balance: { increment: amount } },
      });
    }

    await tx.transaction.create({
      data: {
        orderId,
        personaId,
        userId: adminId,
        billingType,
        type: 'INCOME',
        paymentMethod,
        amount,
        description,
        cashDrawerId,
        bankAccountId,
        verified: true,
      },
    });
  } else {
    await tx.persona.update({
      where: { id: personaId },
      data: { outstandingBalance: { increment: amount } },
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
      : await tx.cashDrawer.findFirst({ where: { userId: adminId, status: 'OPEN' } });

    if (!activeDrawer && userRole !== 'ADMIN' && userRole !== 'FACTURACION') {
      throw new Error(
        'Debe abrir la Caja o seleccionar una caja operativa válida antes de registrar cobros en efectivo.',
      );
    }
    cashDrawerId = activeDrawer?.id;
  } else if (paymentMethod === 'BANK_TRANSFER') {
    const selectedBankId = bankAccountId
      ? Number(bankAccountId)
      : (await tx.bankAccount.findFirst())?.id;
    if (!selectedBankId) {
      throw new Error('No se encontró ninguna cuenta bancaria configurada en el sistema.');
    }
    bankAccountIdVal = selectedBankId;
  } else if (paymentMethod === 'CHECK') {
    const defaultBank = await tx.bankAccount.findFirst();
    bankAccountIdVal = defaultBank?.id;
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
