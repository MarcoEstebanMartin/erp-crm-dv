import prisma from '../utils/prisma';
import { logAudit } from '../utils/audit';
import { Role, PaymentMethod, TransactionType, BillingType, OrderStatus } from '@prisma/client';

export class PersonaService {
  /**
   * Obtener listado de personas con filtros.
   */
  async getPersonas(userId: number, userRole: string, search?: string, role?: string) {
    const whereClause: any = {};

    if (userRole === Role.VENDEDOR) {
      whereClause.sellerId = userId;
    }

    if (role === 'client') whereClause.isClient = true;
    else if (role === 'provider') whereClause.isProvider = true;
    else if (role === 'seller') whereClause.isSeller = true;
    else if (role === 'commission') whereClause.isCommissionAgent = true;

    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { cuit: { contains: search, mode: 'insensitive' } },
      ];
    }

    return prisma.persona.findMany({
      where: whereClause,
      include: {
        seller: {
          select: { id: true, username: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Obtener una persona por ID.
   */
  async getPersonaById(id: number, userId: number, userRole: string) {
    const persona = await prisma.persona.findUnique({
      where: { id },
      include: {
        seller: {
          select: { id: true, username: true },
        },
      },
    });

    if (!persona) throw new Error('Persona no encontrada.');

    if (userRole === Role.VENDEDOR && persona.isClient && persona.sellerId !== userId) {
      throw new Error('Acceso denegado.');
    }

    return persona;
  }

  /**
   * Crear nueva persona.
   */
  async createPersona(data: any, userId: number, userRole: string) {
    let finalSellerId = data.sellerId ? Number(data.sellerId) : null;
    if (userRole === Role.VENDEDOR) {
      finalSellerId = userId;
    }

    const persona = await prisma.persona.create({
      data: {
        name: data.name,
        cuit: data.cuit,
        address: data.address,
        city: data.city,
        province: data.province,
        zipCode: data.zipCode,
        phone: data.phone,
        email: data.email,
        route: data.route,
        isClient: data.isClient !== undefined ? Boolean(data.isClient) : true,
        isProvider: data.isProvider !== undefined ? Boolean(data.isProvider) : false,
        isSeller: data.isSeller !== undefined ? Boolean(data.isSeller) : false,
        isCommissionAgent: data.isCommissionAgent !== undefined ? Boolean(data.isCommissionAgent) : false,
        creditLimit: data.creditLimit !== undefined ? Number(data.creditLimit) : 0.00,
        priceList: data.priceList || 'A',
        discount: data.discount !== undefined ? Number(data.discount) : 0.00,
        contacts: data.contacts !== undefined ? data.contacts : null,
        sellerId: finalSellerId,
      },
    });

    await logAudit({
      userId,
      action: 'CREATE_PERSONA',
      entityType: 'Persona',
      entityId: persona.id,
      newValues: persona,
    });

    return persona;
  }

  /**
   * Actualizar persona.
   */
  async updatePersona(id: number, data: any, userId: number, userRole: string) {
    const original = await prisma.persona.findUnique({ where: { id } });
    if (!original) throw new Error('Persona no encontrada.');

    if (userRole === Role.VENDEDOR && original.isClient && original.sellerId !== userId) {
      throw new Error('Acceso denegado.');
    }

    let finalSellerId = original.sellerId;
    if (userRole === Role.ADMIN && data.sellerId !== undefined) {
      finalSellerId = data.sellerId ? Number(data.sellerId) : null;
    }

    const updated = await prisma.persona.update({
      where: { id },
      data: {
        name: data.name !== undefined ? data.name : undefined,
        cuit: data.cuit !== undefined ? data.cuit : undefined,
        address: data.address !== undefined ? data.address : undefined,
        city: data.city !== undefined ? data.city : undefined,
        province: data.province !== undefined ? data.province : undefined,
        zipCode: data.zipCode !== undefined ? data.zipCode : undefined,
        phone: data.phone !== undefined ? data.phone : undefined,
        email: data.email !== undefined ? data.email : undefined,
        route: data.route !== undefined ? data.route : undefined,
        isClient: data.isClient !== undefined ? Boolean(data.isClient) : undefined,
        isProvider: data.isProvider !== undefined ? Boolean(data.isProvider) : undefined,
        isSeller: data.isSeller !== undefined ? Boolean(data.isSeller) : undefined,
        isCommissionAgent: data.isCommissionAgent !== undefined ? Boolean(data.isCommissionAgent) : undefined,
        creditLimit: data.creditLimit !== undefined ? Number(data.creditLimit) : undefined,
        priceList: data.priceList !== undefined ? data.priceList : undefined,
        discount: data.discount !== undefined ? Number(data.discount) : undefined,
        contacts: data.contacts !== undefined ? data.contacts : undefined,
        sellerId: finalSellerId,
      },
    });

    await logAudit({
      userId,
      action: 'UPDATE_PERSONA',
      entityType: 'Persona',
      entityId: updated.id,
      oldValues: original,
      newValues: updated,
    });

    return updated;
  }

  /**
   * Registrar pago/cobro.
   */
  async recordPersonaPayment(id: number, data: any, userId: number, userRole: string) {
    const { amount, paymentMethod, description, branch, type, supplierInvoiceId, orderId } = data;
    const selectedBranch = branch || 'X';

    const persona = await prisma.persona.findUnique({ where: { id } });
    if (!persona) throw new Error('Persona no encontrada.');

    if (userRole === Role.VENDEDOR && persona.isClient && persona.sellerId !== userId) {
      throw new Error('Acceso denegado.');
    }

    const paymentAmount = Number(amount);
    const isSupplier = persona.isProvider && !persona.isClient;
    const resolvedType = (type === 'OUTCOME' || type === 'INCOME') ? (type as TransactionType) : (isSupplier ? TransactionType.OUTCOME : TransactionType.INCOME);

    // Control de duplicados (Idempotencia)
    if (resolvedType === TransactionType.INCOME) {
      const fifteenSecondsAgo = new Date(Date.now() - 15000);
      const duplicateTx = await prisma.transaction.findFirst({
        where: {
          personaId: persona.id,
          amount: paymentAmount,
          paymentMethod: paymentMethod as PaymentMethod,
          type: TransactionType.INCOME,
          createdAt: {
            gte: fifteenSecondsAgo
          }
        }
      });
      if (duplicateTx) {
        throw new Error('Ya se registró un cobro idéntico para este cliente hace instantes. Por favor, verifica el historial.');
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      let invoiceNumberToLog = '';
      if (supplierInvoiceId) {
        const supplierInvoice = await tx.supplierInvoice.findUnique({ where: { id: Number(supplierInvoiceId) } });
        if (!supplierInvoice) throw new Error('Factura de proveedor no encontrada.');
        if (supplierInvoice.personaId !== persona.id) throw new Error('El comprobante no pertenece a este proveedor.');

        const currentPaid = Number(supplierInvoice.paidAmount || 0);
        const newPaid = currentPaid + paymentAmount;
        const newStatus = newPaid >= Number(supplierInvoice.totalAmount) ? 'PAID' : 'PARTIALLY_PAID';

        await tx.supplierInvoice.update({
          where: { id: supplierInvoice.id },
          data: { paidAmount: newPaid, status: newStatus },
        });
        invoiceNumberToLog = supplierInvoice.invoiceNumber;
      }

      let cashDrawerId: number | null = null;
      if (paymentMethod === PaymentMethod.CASH) {
        const activeDrawer = await tx.cashDrawer.findFirst({
          where: { userId, status: 'OPEN' },
        });
        if (!activeDrawer) throw new Error(`Debés tener la Caja Grande abierta antes de registrar cobros/pagos en efectivo.`);
        cashDrawerId = activeDrawer.id;
      }

      let bankAccountId: number | null = null;
      if (paymentMethod === PaymentMethod.BANK_TRANSFER || paymentMethod === PaymentMethod.CHECK) {
        const bankAcc = await tx.bankAccount.findFirst();
        if (!bankAcc) throw new Error('No hay ninguna cuenta bancaria registrada en el sistema.');
        bankAccountId = bankAcc.id;

        await tx.bankAccount.update({
          where: { id: bankAccountId },
          data: {
            balance: { increment: resolvedType === TransactionType.INCOME ? paymentAmount : -paymentAmount },
          },
        });
      }

      // Buscar número de factura si se especificó orderId para la descripción
      let orderNumberDesc = '';
      if (orderId) {
        const targetOrder = await tx.order.findUnique({ where: { id: Number(orderId) } });
        if (targetOrder) {
          orderNumberDesc = targetOrder.invoiceNumber || `INT-${targetOrder.id.toString().padStart(8, '0')}`;
        }
      }

      const transaction = await tx.transaction.create({
        data: {
          personaId: persona.id,
          userId,
          billingType: selectedBranch === 'A' ? BillingType.OFFICIAL : BillingType.INTERNAL,
          type: resolvedType,
          paymentMethod: paymentMethod as PaymentMethod,
          amount: paymentAmount,
          description: description || (supplierInvoiceId 
            ? `Pago de Factura Nro ${invoiceNumberToLog}`
            : (orderId 
              ? `Cobro de Factura ${orderNumberDesc}`
              : `${resolvedType === TransactionType.OUTCOME ? 'Pago' : 'Cobro'} en cuenta corriente de ${persona.name}`)),
          cashDrawerId,
          bankAccountId,
          supplierInvoiceId: supplierInvoiceId ? Number(supplierInvoiceId) : null,
          orderId: orderId ? Number(orderId) : null,
        },
      });

      // Guardar retenciones si corresponden
      let retencionesTotal = 0;
      if (data.retenciones && Array.isArray(data.retenciones)) {
        for (const ret of data.retenciones) {
          retencionesTotal += Number(ret.amount);
          await tx.taxWithholding.create({
            data: {
              type: 'RETENCION_SUFRIDA',
              taxType: ret.taxType, // "GANANCIAS" | "IIBB"
              personaId: persona.id,
              number: ret.number,
              date: new Date(),
              amount: Number(ret.amount),
              jurisdiction: ret.taxType === 'IIBB' ? 'AR-B' : null, // Por defecto Buenos Aires (AR-B)
            }
          });
        }
      }

      // El total que cancela la cuenta corriente es el monto cobrado + retenciones
      const totalCredit = paymentAmount + retencionesTotal;

      const updatedPersona = await tx.persona.update({
        where: { id: persona.id },
        data: {
          outstandingBalance: {
            decrement: resolvedType === TransactionType.INCOME ? totalCredit : -totalCredit,
          },
        },
      });

      return { transaction, updatedPersona };
    });

    await logAudit({
      userId,
      action: 'RECORD_PERSONA_PAYMENT',
      entityType: 'Persona',
      entityId: persona.id,
      newValues: {
        transactionId: result.transaction.id,
        amount: paymentAmount,
        type: resolvedType,
        newOutstandingBalance: result.updatedPersona.outstandingBalance.toString(),
      },
    });

    return result;
  }

  /**
   * Obtener libro diario.
   */
  async getPersonaLedger(id: number, userId: number, userRole: string) {
    const persona = await prisma.persona.findUnique({ 
      where: { id },
      include: { seller: { select: { id: true, username: true } } }
    });
    if (!persona) throw new Error('Persona no encontrada.');

    if (userRole === Role.VENDEDOR && persona.isClient && persona.sellerId !== userId) {
      throw new Error('Acceso denegado.');
    }

    const orders = await prisma.order.findMany({
      where: { personaId: persona.id, status: 'DELIVERED' },
      orderBy: { createdAt: 'asc' },
    });

    const transactions = await prisma.transaction.findMany({
      where: { personaId: persona.id },
      orderBy: { createdAt: 'asc' },
    });

    const supplierInvoices = await prisma.supplierInvoice.findMany({
      where: { personaId: persona.id },
      orderBy: { issueDate: 'asc' },
    });

    const creditNotes = await prisma.creditNote.findMany({
      where: { personaId: persona.id },
      orderBy: { createdAt: 'asc' },
    });

    const withholdings = await prisma.taxWithholding.findMany({
      where: { personaId: persona.id, type: 'RETENCION_SUFRIDA' },
      orderBy: { date: 'asc' },
    });

    const ledgerItems: any[] = [];

    orders.forEach((o) => {
      ledgerItems.push({
        id: `order-${o.id}`,
        date: o.createdAt,
        type: 'DEBIT',
        reference: `Pedido #${o.id}`,
        description: `Factura ${o.invoiceNumber || 'INT-' + o.id.toString().padStart(8, '0')}`,
        amount: Number(o.totalAmount),
      });
    });

    transactions.forEach((t) => {
      const ledgerType = t.type === TransactionType.INCOME ? 'CREDIT' : 'DEBIT';
      ledgerItems.push({
        id: `transaction-${t.id}`,
        date: t.createdAt,
        type: ledgerType,
        reference: `Recibo #${t.id}`,
        description: t.type === TransactionType.INCOME
          ? `Recibo N° ${t.receiptNumber || 'INT-' + t.id.toString().padStart(8, '0')}`
          : `Pago N° ${t.receiptNumber || 'INT-' + t.id.toString().padStart(8, '0')}`,
        amount: Number(t.amount),
      });
    });

    supplierInvoices.forEach((si) => {
      ledgerItems.push({
        id: `supplier-invoice-${si.id}`,
        date: si.issueDate,
        type: 'CREDIT',
        reference: `Factura Nro ${si.invoiceNumber}`,
        description: `Compra - Factura ${si.invoiceType.replace('_', ' ')}`,
        amount: Number(si.totalAmount),
      });
    });

    creditNotes.forEach((cn) => {
      ledgerItems.push({
        id: `credit-note-${cn.id}`,
        date: cn.createdAt,
        type: 'CREDIT',
        reference: `Nota de Crédito #${cn.id}`,
        description: `${cn.creditNoteType.replace(/_/g, ' ')} ${cn.creditNoteNumber || 'INT-' + cn.id.toString().padStart(8, '0')} (${cn.reason})`,
        amount: Number(cn.totalAmount),
      });
    });

    withholdings.forEach((w) => {
      ledgerItems.push({
        id: `withholding-${w.id}`,
        date: w.date,
        type: 'CREDIT',
        reference: `Retención Cert. Nro ${w.number}`,
        description: `Retención Recibida - ${w.taxType === 'IIBB' ? 'IIBB Bs.As.' : 'Ganancias'}`,
        amount: Number(w.amount),
        metadata: {
          taxType: w.taxType,
          number: w.number,
          amount: Number(w.amount),
          date: w.date,
          jurisdiction: w.jurisdiction
        }
      });
    });

    ledgerItems.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let runningBalance = 0;
    const ledger = ledgerItems.map((item) => {
      if (item.type === 'DEBIT') {
        runningBalance += item.amount;
      } else {
        runningBalance -= item.amount;
      }
      return { ...item, balance: runningBalance };
    });

    return { persona, ledger };
  }

  /**
   * Obtener facturas pendientes de un cliente.
   */
  async getPersonaPendingInvoices(id: number, userId: number, userRole: string) {
    const persona = await prisma.persona.findUnique({ where: { id } });
    if (!persona) throw new Error('Persona no encontrada.');

    if (userRole === Role.VENDEDOR && persona.isClient && persona.sellerId !== userId) {
      throw new Error('Acceso denegado.');
    }

    // Obtener todas las facturas (órdenes con status DELIVERED)
    const orders = await prisma.order.findMany({
      where: {
        personaId: persona.id,
        status: OrderStatus.DELIVERED
      },
      include: {
        transactions: {
          where: {
            type: TransactionType.INCOME
          }
        },
        creditNotes: true
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    const pendingInvoices = orders.map(order => {
      const paidAmount = order.transactions.reduce((acc, tx) => acc + Number(tx.amount), 0);
      const creditNotesAmount = order.creditNotes.reduce((acc, cn) => acc + Number(cn.totalAmount), 0);
      const pendingAmount = Number(order.totalAmount) - paidAmount - creditNotesAmount;

      return {
        id: order.id,
        invoiceNumber: order.invoiceNumber || `INT-${order.id.toString().padStart(8, '0')}`,
        billingType: order.billingType,
        invoiceType: order.invoiceType,
        totalAmount: Number(order.totalAmount),
        paidAmount,
        creditNotesAmount,
        pendingAmount,
        createdAt: order.createdAt
      };
    }).filter(inv => inv.pendingAmount > 0);

    return pendingInvoices;
  }

  /**
   * Obtener reporte consolidado de deudores con saldo por sucursales y advertencias.
   */
  async getDebtorsReport(userId: number, userRole: string) {
    const whereClause: any = {
      isClient: true,
      outstandingBalance: { gt: 0 }
    };

    if (userRole === Role.VENDEDOR) {
      whereClause.sellerId = userId;
    }

    const clients = await prisma.persona.findMany({
      where: whereClause,
      include: {
        seller: { select: { id: true, username: true } },
        orders: {
          where: { status: OrderStatus.DELIVERED },
          include: {
            transactions: {
              where: { type: TransactionType.INCOME }
            },
            creditNotes: true
          },
          orderBy: { createdAt: 'asc' }
        },
        transactions: {
          where: {
            type: TransactionType.INCOME,
            orderId: null // Pagos generales a cuenta corriente
          }
        },
        creditNotes: {
          where: {
            orderId: null // Notas de crédito generales a cuenta corriente
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    const debtors = clients.map(client => {
      // 1. Agrupar órdenes por sucursal
      const officialOrders = client.orders.filter(o => o.billingType === BillingType.OFFICIAL);
      const internalOrders = client.orders.filter(o => o.billingType === BillingType.INTERNAL);

      // 2. Sumar créditos generales por sucursal
      const officialIncomes = client.transactions.filter(t => t.billingType === BillingType.OFFICIAL);
      const internalIncomes = client.transactions.filter(t => t.billingType === BillingType.INTERNAL);

      const officialCreditNotes = client.creditNotes.filter(cn => cn.billingType === BillingType.OFFICIAL);
      const internalCreditNotes = client.creditNotes.filter(cn => cn.billingType === BillingType.INTERNAL);

      const totalOfficialCredit = officialIncomes.reduce((acc, t) => acc + Number(t.amount), 0) +
                                  officialCreditNotes.reduce((acc, cn) => acc + Number(cn.totalAmount), 0);

      const totalInternalCredit = internalIncomes.reduce((acc, t) => acc + Number(t.amount), 0) +
                                  internalCreditNotes.reduce((acc, cn) => acc + Number(cn.totalAmount), 0);

      // Helper para calcular saldo pendiente de órdenes por sucursal usando FIFO
      const calculateFIFO = (orders: typeof client.orders, unallocatedCredit: number) => {
        let pool = unallocatedCredit;
        let pendingInvoicesCount = 0;
        let remainingDebt = 0;

        const detailedOrders = orders.map(order => {
          const directPayments = order.transactions.reduce((acc, t) => acc + Number(t.amount), 0);
          const directCreditNotes = order.creditNotes.reduce((acc, cn) => acc + Number(cn.totalAmount), 0);
          
          let debt = Math.max(0, Number(order.totalAmount) - directPayments - directCreditNotes);

          if (pool > 0) {
            if (debt <= pool) {
              pool -= debt;
              debt = 0;
            } else {
              debt -= pool;
              pool = 0;
            }
          }

          if (debt > 0.5) {
            pendingInvoicesCount++;
            remainingDebt += debt;
          }

          return {
            id: order.id,
            invoiceNumber: order.invoiceNumber || `INT-${order.id.toString().padStart(8, '0')}`,
            totalAmount: Number(order.totalAmount),
            pendingAmount: debt,
            createdAt: order.createdAt
          };
        });

        return { remainingDebt, pendingInvoicesCount, detailedOrders };
      };

      const officialResult = calculateFIFO(officialOrders, totalOfficialCredit);
      const internalResult = calculateFIFO(internalOrders, totalInternalCredit);

      let debtA = officialResult.remainingDebt;
      let debtX = internalResult.remainingDebt;
      const totalCalculated = debtA + debtX;
      const dbOutstanding = Number(client.outstandingBalance);

      // 3. Ajuste de seguridad para coincidir con la cuenta corriente de la base de datos
      if (dbOutstanding > 0) {
        if (totalCalculated > 0) {
          const ratioA = debtA / totalCalculated;
          debtA = Math.round(ratioA * dbOutstanding);
          debtX = dbOutstanding - debtA;
        } else {
          // Si no hay órdenes entregadas pero tiene deuda en cuenta corriente, asignar a la sucursal X por defecto
          debtX = dbOutstanding;
          debtA = 0;
        }
      } else {
        debtA = 0;
        debtX = 0;
      }

      return {
        id: client.id,
        name: client.name,
        cuit: client.cuit,
        address: client.address,
        city: resolveCity(client.city, client.address, client.route),
        province: client.province,
        zipCode: client.zipCode,
        phone: client.phone,
        email: client.email,
        route: client.route || 'Sin Ruta',
        outstandingBalance: dbOutstanding,
        debtA: Math.max(0, debtA),
        debtX: Math.max(0, debtX),
        pendingInvoicesCount: officialResult.pendingInvoicesCount + internalResult.pendingInvoicesCount,
        hasMultiplePendingInvoices: (officialResult.pendingInvoicesCount + internalResult.pendingInvoicesCount) > 1,
        sellerId: client.sellerId,
        sellerName: client.seller?.username || 'Sin Preventista'
      };
    });

    const availableRoutes = [...new Set(debtors.map(d => d.route).filter(r => r && r !== 'Sin Ruta'))].sort();
    const availableCities = [...MAIN_CITIES, 'OTRAS'].sort();

    // Obtener preventistas
    const sellers = await prisma.user.findMany({
      where: { role: 'VENDEDOR' },
      select: { id: true, username: true }
    });

    return { debtors, availableRoutes, availableCities, availableSellers: sellers };
  }
}

const MAIN_CITIES = [
  'GENERAL VILLEGAS',
  'EMILIO V. BUNGE',
  'BANDERALO',
  'INTENDENTE ALVEAR',
  'PIEDRITAS',
  'CEBALLOS',
  'RUFINO',
  'BUCHARDO',
  'CHARLONE',
  'LARROUDE',
  'SAUCE',
  'SANSINENA',
  'TRES ALGARROBOS',
  'AMEGHINO',
  'BLAQUIER',
  'AMERICA',
  'FORTIN',
  'CARLOS TEJEDOR',
  'OFICINA'
];

function normalizeCityName(str: string | null | undefined): string {
  if (!str) return 'OTRAS';
  const upper = str.toUpperCase().trim();
  
  for (const mainCity of MAIN_CITIES) {
    if (upper.includes(mainCity)) {
      return mainCity;
    }
  }

  // Alternativas de nombres comunes o abreviaciones
  if (upper.includes('BUNGE')) return 'EMILIO V. BUNGE';
  if (upper.includes('ALVEAR') || upper.includes('I. ALVEAR') || upper.includes('I.ALVEAR')) return 'INTENDENTE ALVEAR';
  if (upper.includes('VILLEGAS')) return 'GENERAL VILLEGAS';
  if (upper.includes('LARROUDE')) return 'LARROUDE';
  if (upper.includes('TEJEDOR')) return 'CARLOS TEJEDOR';
  if (upper.includes('SAUZE')) return 'SAUCE';

  return 'OTRAS';
}

function resolveCity(
  city: string | null | undefined,
  address: string | null | undefined,
  route: string | null | undefined
): string {
  // 1. Intentar con el campo 'city'
  if (city) {
    const norm = normalizeCityName(city);
    if (norm !== 'OTRAS') return norm;
  }

  // 2. Intentar con el campo 'address'
  if (address) {
    const norm = normalizeCityName(address);
    if (norm !== 'OTRAS') return norm;
  }

  // 3. Intentar con el campo 'route'
  if (route) {
    const norm = normalizeCityName(route);
    if (norm !== 'OTRAS') return norm;
  }

  return 'OTRAS';
}

export const personaService = new PersonaService();
