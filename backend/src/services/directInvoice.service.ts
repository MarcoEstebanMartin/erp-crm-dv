import prisma from '../utils/prisma';
import { Role, BillingType, InvoiceType, OrderStatus, MovementType, TransactionType, PaymentMethod, SalesChannel } from '@prisma/client';
import { emitirFacturaAFIP } from './afip.service';
import { logAudit } from '../utils/audit';

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

function getJurisdictionCode(provinceOrAddress?: string | null): string {
  if (!provinceOrAddress) return 'AR-B';
  const p = provinceOrAddress.toLowerCase();
  if (p.includes('misiones')) return 'AR-N';
  if (p.includes('corrientes')) return 'AR-W';
  if (p.includes('caba') || p.includes('capital') || p.includes('ciudad aut')) return 'AR-C';
  if (p.includes('buenos aires') || p.includes('bs')) return 'AR-B';
  return 'AR-B';
}

export class DirectInvoiceService {
  /**
   * Genera una factura directa por mostrador (Oficial AFIP o Interna),
   * descontando stock de lotes FIFO y registrando el cobro o saldo en cuenta corriente.
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
      items
    } = data;

    // 1. Obtener cliente/persona
    const persona = await prisma.persona.findUnique({ where: { id: personaId } });
    if (!persona) {
      throw new Error('Cliente no encontrado.');
    }

    // 2. Cargar todos los productos y validar stock previo a AFIP
    const productIds = items.map(item => item.productId);
    const dbProducts = await prisma.product.findMany({
      where: { id: { in: productIds } }
    });

    let totalSum = 0;
    const orderItemsData: any[] = [];

    for (const item of items) {
      const product = dbProducts.find(p => p.id === item.productId);
      if (!product) {
        throw new Error(`Producto ID ${item.productId} no encontrado.`);
      }

      if (product.stock < item.quantity && process.env.IGNORE_STOCK_CHECK !== 'true') {
        throw new Error(
          `Stock insuficiente para "${product.name}" (Disponible: ${product.stock}, Solicitado: ${item.quantity}).`
        );
      }

      // Determinar precio unitario base según la lista del cliente
      let selectedPrice = Number(product.listPrice);
      let itemDiscount = Number(persona.discount || 0);

      if (persona.priceList === 'B') {
        selectedPrice = Number(product.listPriceB) > 0 ? Number(product.listPriceB) : Number(product.listPrice);
        const isMelincue = product.description?.toUpperCase() === 'MELINCUE' || product.name?.toUpperCase().includes('MELINCUE');
        itemDiscount = isMelincue ? 3 : 0;
      } else if (persona.priceList === 'C') {
        selectedPrice = Number(product.listPriceC) > 0 ? Number(product.listPriceC) : Number(product.listPrice);
      }

      // Aplicar descuento
      const finalUnitPrice = Math.round(selectedPrice * (1 - itemDiscount / 100));
      const actualQuantityForPrice = product.isPesable 
        ? (item.weight ? Number(item.weight) : item.quantity * Number((product as any).approximateWeight || 1))
        : item.quantity;
      const subtotal = Math.round(finalUnitPrice * actualQuantityForPrice);
      totalSum += subtotal;

      orderItemsData.push({
        productId: product.id,
        quantity: item.quantity,
        weight: product.isPesable ? (item.weight ? Number(item.weight) : item.quantity * Number((product as any).approximateWeight || 1)) : null,
        unitPrice: finalUnitPrice,
        subtotal,
        productName: product.name,
      });
    }

    totalSum = Math.round(totalSum);

    // 3. Validar límite de crédito y boleta contra boleta
    const creditLimit = Number(persona.creditLimit || 0);
    const outstandingBalance = Number(persona.outstandingBalance || 0);
    if (creditLimit > 0 && (outstandingBalance + totalSum) > creditLimit) {
      if (userRole !== Role.ADMIN) {
        throw new Error(
          `Límite de crédito excedido. Saldo actual: $${outstandingBalance.toLocaleString()}, Disponible: $${(creditLimit - outstandingBalance).toLocaleString()}, Requerido: $${totalSum.toLocaleString()}.`
        );
      }
    }

    if (!paymentMethod && outstandingBalance > 0) {
      if (userRole !== Role.ADMIN) {
        throw new Error(
          `Regla Boleta contra Boleta: El cliente posee una boleta pendiente ($${outstandingBalance.toLocaleString()}). Debe registrar su cobro para poder facturar a crédito.`
        );
      }
    }

    // 4. Determinar datos impositivos y generar Factura AFIP o Interna
    let finalInvoiceType: InvoiceType = InvoiceType.PRESUPUESTO;
    let finalInvoiceNumber: string | null = null;
    let finalCae: string | null = null;
    let finalCaeDueDate: Date | null = null;

    let net = Math.round(totalSum / 1.21);
    let tax = totalSum - net;

    const cuitLimpio = persona.cuit ? persona.cuit.replace(/-/g, '') : '';
    let docType = 99;

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
    } else {
      finalInvoiceType = InvoiceType.PRESUPUESTO;
    }

    // Calcular desglose impositivo (Bottom-Up)
    net = Number((totalSum / 1.21).toFixed(2));
    tax = Number((totalSum - net).toFixed(2));
    let percepIIBB = 0;
    let percepIVA = 0;

    const isFacturaA_Official = billingType === BillingType.OFFICIAL && finalInvoiceType === InvoiceType.FACTURA_A;
    if (isFacturaA_Official) {
      const perceptionIVA = await prisma.perceptionType.findUnique({
        where: { code: 'IVA_5329' }
      });
      
      const applyIvaPerc = totalSum > 100000;
      const ivaPercAliquot = applyIvaPerc ? ((perceptionIVA && perceptionIVA.aliquot) ? Number(perceptionIVA.aliquot) : 3.00) : 0;
      const iibbAliquot = Number(persona.iibbAliquot || 0);

      percepIIBB = Number((net * (iibbAliquot / 100)).toFixed(2));
      percepIVA = Number((net * (ivaPercAliquot / 100)).toFixed(2));
      totalSum = Number((net + tax + percepIIBB + percepIVA).toFixed(2));
    }

    if (billingType === BillingType.OFFICIAL) {
      try {
        const afipRes = await emitirFacturaAFIP({
          clientCuit: cuitLimpio,
          clientDocType: docType,
          invoiceType: finalInvoiceType === InvoiceType.FACTURA_A ? 'A' : 'B',
          total: totalSum,
          neto: isFacturaA_Official ? Number(net.toFixed(2)) : undefined,
          iva: isFacturaA_Official ? Number(tax.toFixed(2)) : undefined,
          percepcionAmount: isFacturaA_Official ? Number(percepIIBB.toFixed(2)) : undefined,
          percepcionIvaAmount: isFacturaA_Official ? Number(percepIVA.toFixed(2)) : undefined,
        });

        finalInvoiceNumber = afipRes.invoiceNumber;
        finalCae = afipRes.cae;
        finalCaeDueDate = afipRes.caeDueDate;
      } catch (err: any) {
        throw new Error(`Error AFIP al emitir factura: ${err.message}`);
      }
    }

    // PERSISTENCIA AISLADA DE FACTURACIÓN:
    // Creamos primero el registro de la orden principal con sus datos fiscales.
    let order;
    try {
      order = await prisma.order.create({
        data: {
          personaId,
          sellerId: adminId,
          status: OrderStatus.DELIVERED,
          billingType,
          salesChannel: salesChannel || SalesChannel.MOSTRADOR,
          totalAmount: totalSum,
          netAmount: billingType === BillingType.OFFICIAL && finalInvoiceType === InvoiceType.FACTURA_A ? Number(net.toFixed(2)) : Math.round(net),
          taxAmount: billingType === BillingType.OFFICIAL && finalInvoiceType === InvoiceType.FACTURA_A ? Number(tax.toFixed(2)) : Math.round(tax),
          percepcionAmount: billingType === BillingType.OFFICIAL && finalInvoiceType === InvoiceType.FACTURA_A ? Number(percepIIBB.toFixed(2)) : Math.round(percepIIBB),
          percepcionIvaAmount: billingType === BillingType.OFFICIAL && finalInvoiceType === InvoiceType.FACTURA_A ? Number(percepIVA.toFixed(2)) : Math.round(percepIVA),
          invoiceType: finalInvoiceType,
          cae: finalCae,
          caeDueDate: finalCaeDueDate ? new Date(finalCaeDueDate) : null,
          invoiceNumber: finalInvoiceNumber
        },
      });

      if (!finalInvoiceNumber) {
        finalInvoiceNumber = `INT-${order.id.toString().padStart(5, '0')}`;
        order = await prisma.order.update({
          where: { id: order.id },
          data: { invoiceNumber: finalInvoiceNumber }
        });
      }
    } catch (creationError: any) {
      console.error('❌ Error crítico al guardar orden básica en base de datos local:', creationError);
      throw new Error(`La factura fue procesada pero ocurrió un error al registrarla localmente: ${creationError.message}.`);
    }

    // Transacción secundaria para stock, lotes, percepciones y cobros
    try {
      const result = await prisma.$transaction(async (tx) => {
        // Descontar stock general atómicamente
        for (const itemData of orderItemsData) {
          if (process.env.IGNORE_STOCK_CHECK === 'true') {
            await tx.product.update({
              where: { id: itemData.productId },
              data: { stock: { decrement: itemData.quantity } },
            });
          } else {
            const res = await tx.product.updateMany({
              where: {
                id: itemData.productId,
                stock: { gte: itemData.quantity },
              },
              data: {
                stock: { decrement: itemData.quantity },
              },
            });

            if (res.count === 0) {
              throw new Error(`Stock insuficiente para "${itemData.productName}" debido a una operación concurrente. Por favor reintente la venta.`);
            }
          }
        }

        // Crear los OrderItems y asignar lotes FIFO
        for (const itemData of orderItemsData) {
          const orderItem = await tx.orderItem.create({
            data: {
              orderId: order.id,
              productId: itemData.productId,
              quantity: itemData.quantity,
              weight: itemData.weight,
              unitPrice: itemData.unitPrice,
              subtotal: itemData.subtotal,
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

          // Asignación de lotes FIFO
          let remainingToAssign = itemData.quantity;
          const activeLots = await tx.productLot.findMany({
            where: { productId: itemData.productId, stock: { gt: 0 } },
            orderBy: { expirationDate: 'asc' },
          });

          for (const lot of activeLots) {
            if (remainingToAssign <= 0) break;

            const allocatedQty = Math.min(lot.stock, remainingToAssign);
            remainingToAssign -= allocatedQty;

            await tx.productLot.update({
              where: { id: lot.id },
              data: { stock: { decrement: allocatedQty } },
            });

            await tx.orderItemLot.create({
              data: {
                orderItemId: orderItem.id,
                productLotId: lot.id,
                quantity: allocatedQty,
              },
            });
          }

          if (remainingToAssign > 0) {
            if (process.env.IGNORE_STOCK_CHECK === 'true') {
              let slLot = await tx.productLot.findFirst({
                where: { productId: itemData.productId, lotNumber: 'S/L' },
              });

              if (!slLot) {
                slLot = await tx.productLot.create({
                  data: {
                    productId: itemData.productId,
                    lotNumber: 'S/L',
                    expirationDate: new Date('2036-12-31T00:00:00Z'),
                    stock: 0,
                    location: 'S/U',
                  },
                });
              }

              await tx.productLot.update({
                where: { id: slLot.id },
                data: { stock: { decrement: remainingToAssign } },
              });

              await tx.orderItemLot.create({
                data: {
                  orderItemId: orderItem.id,
                  productLotId: slLot.id,
                  quantity: remainingToAssign,
                },
              });
            }
          }
        }

        // Percepciones IIBB e IVA
        if (percepIIBB > 0) {
          await tx.taxWithholding.create({
            data: {
              type: 'PERCEPCION_PRACTICADA',
              taxType: 'IIBB',
              personaId,
              number: finalInvoiceNumber || `FAC-${order.id}`,
              date: new Date(),
              amount: isFacturaA_Official ? Number(percepIIBB.toFixed(2)) : Math.round(percepIIBB),
              jurisdiction: getJurisdictionCode(persona.province || persona.address),
            },
          });
        }

        if (percepIVA > 0) {
          await tx.taxWithholding.create({
            data: {
              type: 'PERCEPCION_PRACTICADA',
              taxType: 'IVA',
              personaId,
              number: finalInvoiceNumber || `FAC-${order.id}`,
              date: new Date(),
              amount: isFacturaA_Official ? Number(percepIVA.toFixed(2)) : Math.round(percepIVA),
              jurisdiction: null,
            },
          });
        }

        // Cobro en caja o registro en Cuenta Corriente
        if (paymentMethod) {
          let cashDrawerId: number | undefined = undefined;
          let bankAccountIdVal: number | undefined = undefined;
          let txAmount = totalSum;
          let txDescription = `Cobro en el acto de factura directa #${order.id} (${finalInvoiceNumber})`;

          if (paymentMethod === PaymentMethod.CASH) {
            let activeDrawer;
            if (explicitCashDrawerId) {
              activeDrawer = await tx.cashDrawer.findFirst({
                where: { id: explicitCashDrawerId, status: 'OPEN' },
              });
            } else {
              activeDrawer = await tx.cashDrawer.findFirst({
                where: { userId: adminId, status: 'OPEN' },
              });
            }

            if (!activeDrawer) {
              if (userRole === Role.ADMIN || userRole === Role.FACTURACION) {
                cashDrawerId = undefined;
              } else {
                throw new Error(`Debe abrir la Caja o seleccionar una caja operativa válida antes de registrar cobros en efectivo.`);
              }
            } else {
              cashDrawerId = activeDrawer.id;
            }
          } else if (paymentMethod === PaymentMethod.BANK_TRANSFER) {
            const selectedBankId = bankAccountId ? Number(bankAccountId) : (await tx.bankAccount.findFirst())?.id;
            if (!selectedBankId) {
              throw new Error(`No se encontró ninguna cuenta bancaria configurada en el sistema.`);
            }
            bankAccountIdVal = selectedBankId;
            await tx.bankAccount.update({
              where: { id: selectedBankId },
              data: { balance: { increment: totalSum } },
            });
          } else if (paymentMethod === PaymentMethod.CHECK) {
            const defaultBank = await tx.bankAccount.findFirst();
            if (defaultBank) {
              bankAccountIdVal = defaultBank.id;
            }
            const cleanCheckNumber = checkNumber ? String(checkNumber).trim() : 'S/N';
            const cleanIssuer = checkIssuer ? String(checkIssuer).trim() : 'Desconocido';
            txAmount = checkAmount && !isNaN(Number(checkAmount)) && Number(checkAmount) > 0 ? Number(checkAmount) : totalSum;
            txDescription = `Cheque N° ${cleanCheckNumber} (Emisor: ${cleanIssuer}) recibido en mostrador por factura #${order.id} (${finalInvoiceNumber})`;
          }

          await tx.transaction.create({
            data: {
              orderId: order.id,
              personaId,
              userId: adminId,
              billingType,
              type: TransactionType.INCOME,
              paymentMethod,
              amount: txAmount,
              description: txDescription,
              cashDrawerId,
              bankAccountId: bankAccountIdVal,
              verified: true,
            },
          });
        } else {
          await tx.persona.update({
            where: { id: personaId },
            data: { outstandingBalance: { increment: totalSum } },
          });
        }

        return await tx.order.findUnique({
          where: { id: order.id },
          include: {
            persona: true,
            items: { include: { product: true } },
          },
        });
      });

      // Auditoría
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
      console.error('❌ Error en el flujo secundario de facturación directa:', secondaryError.message);
      try {
        await prisma.order.update({
          where: { id: order.id },
          data: {
            notes: (order.notes ? order.notes + ' | ' : '') + `[ALERTA AFIP] CAE ${finalCae} emitido pero falló imputación de stock/caja: ${secondaryError.message}. Conciliar manualmente.`
          }
        });
      } catch (noteErr) {
        console.error('No se pudo guardar la nota de alerta en la orden directa:', noteErr);
      }
      throw new Error(
        `La factura oficial fue emitida con éxito (Nro: ${finalInvoiceNumber}, CAE: ${finalCae}). Sin embargo, ocurrió un error al registrar las transacciones financieras o el stock de lotes: ${secondaryError.message}. El comprobante fue registrado con una alerta contable para su conciliación manual.`
      );
    }
  }
}
