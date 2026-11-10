import prisma from '../utils/prisma';
import {
  Role,
  BillingType,
  InvoiceType,
  OrderStatus,
  MovementType,
  TransactionType,
  PaymentMethod,
  SalesChannel,
} from '@prisma/client';
import { emitirFacturaAFIP } from './afip.service';
import { logAudit } from '../utils/audit';
import {
  calculateOrderLine,
  roundToIntegerPeso,
  roundToThreeDecimalsWeight,
  roundToTwoDecimals,
  sumIntegerAmounts,
  toDecimal,
} from '../core/money';
import {
  computeInvoiceTaxBreakdown,
  recordInvoicePerceptions,
  resolveAndSettleOrderPayment,
} from './orders/order-tax.helpers';
import { assignFifoLotsToOrderItem } from './orders/order-billing.helpers';

export interface CreateDirectInvoiceDto {
  adminId: number;
  userRole: string;
  personaId: number;
  billingType: BillingType;
  salesChannel?: SalesChannel;
  paymentMethod?: PaymentMethod;
  bankAccountId?: number;
  cashDrawerId?: number;
  checkNumber?: string;
  checkIssuer?: string;
  checkAmount?: number;
  items: {
    productId: number;
    quantity: number;
    weight?: number | null;
  }[];
}

export class DirectInvoiceService {
  /**
   * Genera una factura directa por mostrador (Oficial AFIP o Interna),
   * descontando stock de lotes FIFO, congelando Snapshots históricos con Decimal.js
   * y registrando el cobro o saldo en cuenta corriente.
   */
  static async createDirectInvoice(data: CreateDirectInvoiceDto) {
    const {
      adminId,
      userRole,
      personaId,
      billingType,
      salesChannel,
      paymentMethod,
      bankAccountId,
      cashDrawerId: explicitCashDrawerId,
      checkNumber,
      checkIssuer,
      checkAmount,
      items,
    } = data;

    const persona = await prisma.persona.findUnique({ where: { id: personaId } });
    if (!persona) {
      throw new Error('Cliente no encontrado.');
    }

    const productIds = items.map((item) => item.productId);
    const dbProducts = await prisma.product.findMany({
      where: { id: { in: productIds } },
    });

    const orderItemsData: any[] = [];

    for (const item of items) {
      const product = dbProducts.find((p) => p.id === item.productId);
      if (!product) {
        throw new Error(`Producto ID ${item.productId} no encontrado.`);
      }

      if (product.stock < item.quantity && process.env.IGNORE_STOCK_CHECK !== 'true') {
        throw new Error(
          `Stock insuficiente para "${product.name}" (Disponible: ${product.stock}, Solicitado: ${item.quantity}).`,
        );
      }

      let selectedPrice = Number(product.listPrice);
      let itemDiscount = Number(persona.discount || 0);

      if (persona.priceList === 'B') {
        selectedPrice =
          Number(product.listPriceB) > 0 ? Number(product.listPriceB) : Number(product.listPrice);
        const isMelincue =
          product.description?.toUpperCase() === 'MELINCUE' ||
          product.name?.toUpperCase().includes('MELINCUE');
        itemDiscount = isMelincue ? 3 : 0;
      } else if (persona.priceList === 'C') {
        selectedPrice =
          Number(product.listPriceC) > 0 ? Number(product.listPriceC) : Number(product.listPrice);
      }

      const approxKg = Number((product as any).approximateWeight || 1) || 1;
      const billableQtyDec = product.isPesable
        ? item.weight
          ? roundToThreeDecimalsWeight(item.weight)
          : roundToThreeDecimalsWeight(toDecimal(item.quantity).times(approxKg))
        : toDecimal(item.quantity);

      const lc = calculateOrderLine({
        unitCost: Number((product as any).costPrice || 0),
        unitPriceList: selectedPrice,
        billableQty: billableQtyDec,
        discountPct: itemDiscount,
      });

      orderItemsData.push({
        productId: product.id,
        quantity: item.quantity,
        weight: product.isPesable ? billableQtyDec.toNumber() : null,
        unitPrice: roundToIntegerPeso(lc.netUnitPrice).toNumber(),
        subtotal: lc.lineSubtotal.toNumber(),
        unitCostSnapshot: lc.unitCostSnapshot.toNumber(),
        listPriceSnapshot: lc.listPriceSnapshot.toNumber(),
        discountPctSnapshot: lc.discountPctSnapshot.toNumber(),
        productName: product.name,
      });
    }

    let totalSum = sumIntegerAmounts(orderItemsData.map((i) => i.subtotal)).toNumber();

    const creditLimit = Number(persona.creditLimit || 0);
    const outstandingBalance = roundToIntegerPeso(persona.outstandingBalance || 0).toNumber();
    if (creditLimit > 0 && outstandingBalance + totalSum > creditLimit && userRole !== Role.ADMIN) {
      throw new Error(
        `Límite de crédito excedido. Saldo actual: $${outstandingBalance.toLocaleString()}, Disponible: $${(creditLimit - outstandingBalance).toLocaleString()}, Requerido: $${totalSum.toLocaleString()}.`,
      );
    }

    if (!paymentMethod && outstandingBalance > 0 && userRole !== Role.ADMIN) {
      throw new Error(
        `Regla Boleta contra Boleta: El cliente posee una boleta pendiente ($${outstandingBalance.toLocaleString()}). Debe registrar su cobro para poder facturar a crédito.`,
      );
    }

    const taxInfo = await computeInvoiceTaxBreakdown(totalSum, billingType, persona);
    totalSum = taxInfo.finalTotal;

    let finalInvoiceNumber: string | null = null;
    let finalCae: string | null = null;
    let finalCaeDueDate: Date | null = null;

    if (billingType === BillingType.OFFICIAL) {
      const afipRes = await emitirFacturaAFIP({
        clientCuit: taxInfo.cuitLimpio,
        clientDocType: taxInfo.docType,
        invoiceType: taxInfo.finalInvoiceType === InvoiceType.FACTURA_A ? 'A' : 'B',
        total: totalSum,
        neto: taxInfo.isFacturaAOfficial ? taxInfo.net : undefined,
        iva: taxInfo.isFacturaAOfficial ? taxInfo.tax : undefined,
        percepcionAmount: taxInfo.isFacturaAOfficial ? taxInfo.percepIIBB : undefined,
        percepcionIvaAmount: taxInfo.isFacturaAOfficial ? taxInfo.percepIVA : undefined,
      }).catch((err: any) => {
        throw new Error(`Error AFIP al emitir factura: ${err.message}`);
      });

      finalInvoiceNumber = afipRes.invoiceNumber;
      finalCae = afipRes.cae;
      finalCaeDueDate = afipRes.caeDueDate;
    }

    let order = await prisma.order.create({
      data: {
        personaId,
        sellerId: adminId,
        status: OrderStatus.DELIVERED,
        billingType,
        salesChannel: salesChannel || SalesChannel.MOSTRADOR,
        totalAmount: totalSum,
        netAmount: taxInfo.isFacturaAOfficial
          ? roundToTwoDecimals(taxInfo.net).toNumber()
          : roundToIntegerPeso(taxInfo.net).toNumber(),
        taxAmount: taxInfo.isFacturaAOfficial
          ? roundToTwoDecimals(taxInfo.tax).toNumber()
          : roundToIntegerPeso(taxInfo.tax).toNumber(),
        percepcionAmount: taxInfo.isFacturaAOfficial
          ? roundToTwoDecimals(taxInfo.percepIIBB).toNumber()
          : roundToIntegerPeso(taxInfo.percepIIBB).toNumber(),
        percepcionIvaAmount: taxInfo.isFacturaAOfficial
          ? roundToTwoDecimals(taxInfo.percepIVA).toNumber()
          : roundToIntegerPeso(taxInfo.percepIVA).toNumber(),
        invoiceType: taxInfo.finalInvoiceType,
        cae: finalCae,
        caeDueDate: finalCaeDueDate ? new Date(finalCaeDueDate) : null,
        invoiceNumber: finalInvoiceNumber,
      },
    });

    if (!finalInvoiceNumber) {
      finalInvoiceNumber = `INT-${order.id.toString().padStart(5, '0')}`;
      order = await prisma.order.update({
        where: { id: order.id },
        data: { invoiceNumber: finalInvoiceNumber },
      });
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        for (const itemData of orderItemsData) {
          if (process.env.IGNORE_STOCK_CHECK === 'true') {
            await tx.product.update({
              where: { id: itemData.productId },
              data: { stock: { decrement: itemData.quantity } },
            });
          } else {
            const res = await tx.product.updateMany({
              where: { id: itemData.productId, stock: { gte: itemData.quantity } },
              data: { stock: { decrement: itemData.quantity } },
            });
            if (res.count === 0) {
              throw new Error(
                `Stock insuficiente para "${itemData.productName}" debido a una operación concurrente. Por favor reintente la venta.`,
              );
            }
          }
        }

        for (const itemData of orderItemsData) {
          const orderItem = await tx.orderItem.create({
            data: {
              orderId: order.id,
              productId: itemData.productId,
              quantity: itemData.quantity,
              weight: itemData.weight,
              unitPrice: itemData.unitPrice,
              subtotal: itemData.subtotal,
              unitCostSnapshot: itemData.unitCostSnapshot,
              listPriceSnapshot: itemData.listPriceSnapshot,
              discountPctSnapshot: itemData.discountPctSnapshot,
            },
          });

          await tx.stockMovement.create({
            data: {
              productId: itemData.productId,
              quantity: -itemData.quantity,
              type: MovementType.OUT,
              orderId: order.id,
              referenceId: `FAC-${order.id}`,
              userId: adminId,
              reason: `Venta directa comprobante ${finalInvoiceNumber || 'INT-' + order.id}`,
            },
          });

          await assignFifoLotsToOrderItem(tx, orderItem.id, itemData.productId, itemData.quantity);
        }

        await recordInvoicePerceptions(tx, {
          personaId,
          invoiceNumber: finalInvoiceNumber || `FAC-${order.id}`,
          percepIIBB: taxInfo.percepIIBB,
          percepIVA: taxInfo.percepIVA,
          isFacturaAOfficial: taxInfo.isFacturaAOfficial,
          provinceOrAddress: persona.province || persona.address,
        });

        await resolveAndSettleOrderPayment(tx, {
          orderId: order.id,
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
          invoiceNumber: finalInvoiceNumber,
        });

        return await tx.order.findUnique({
          where: { id: order.id },
          include: {
            persona: true,
            items: { include: { product: true } },
          },
        });
      });

      await logAudit({
        userId: adminId,
        action: 'CREATE_DIRECT_INVOICE',
        entityType: 'Order',
        entityId: order.id,
        newValues: {
          billingType,
          invoiceNumber: finalInvoiceNumber,
          cae: finalCae,
          total: totalSum,
        },
      });

      return result;
    } catch (secondaryError: any) {
      await prisma.order
        .update({
          where: { id: order.id },
          data: {
            notes:
              (order.notes ? order.notes + ' | ' : '') +
              `[ALERTA AFIP] CAE ${finalCae} emitido pero falló imputación de stock/caja: ${secondaryError.message}. Conciliar manualmente.`,
          },
        })
        .catch(() => {});

      throw new Error(
        `La factura oficial fue emitida con éxito (Nro: ${finalInvoiceNumber}, CAE: ${finalCae}). Sin embargo, ocurrió un error al registrar las transacciones financieras o el stock de lotes: ${secondaryError.message}. El comprobante fue registrado con una alerta contable para su conciliación manual.`,
      );
    }
  }
}
