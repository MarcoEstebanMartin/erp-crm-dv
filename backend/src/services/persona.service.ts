import prisma from '../utils/prisma';
import { logAudit } from '../utils/audit';
import { Role, PaymentMethod, TransactionType, BillingType, OrderStatus } from '@prisma/client';
import { standardizeCityName, standardizeRouteName, getOfficialCityOrOther, OFFICIAL_CITIES } from '../utils/normalize';


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
        { city: { contains: search, mode: 'insensitive' } },
        { route: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
        { saleRoute: { name: { contains: search, mode: 'insensitive' } } }
      ];
    }

    const personas = await prisma.persona.findMany({
      where: whereClause,
      include: {
        seller: {
          select: { id: true, username: true },
        },
        saleRoute: {
          select: { 
            id: true, 
            name: true, 
            dayOfWeek: true,
            seller: {
              select: { id: true, username: true }
            }
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    if (role === 'client') {
      try {
        const report = await this.getDebtorsReport(userId, userRole);
        const debtorMap = new Map();
        report.debtors.forEach((d: any) => debtorMap.set(d.id, d.pendingInvoicesCount));
        
        return personas.map((p) => ({
          ...p,
          pendingInvoicesCount: debtorMap.get(p.id) || 0
        }));
      } catch (err) {
        console.error('Error fetching debtors report inside getPersonas:', err);
        return personas;
      }
    }

    return personas;
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
        saleRoute: {
          select: { 
            id: true, 
            name: true, 
            dayOfWeek: true,
            seller: {
              select: { id: true, username: true }
            }
          },
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
        city: data.city !== undefined && data.city !== null ? standardizeCityName(data.city) : data.city,
        province: data.province,
        zipCode: data.zipCode,
        phone: data.phone,
        email: data.email,
        rubro: data.rubro || null,
        route: data.route !== undefined && data.route !== null ? standardizeRouteName(data.route) : data.route,
        isClient: data.isClient !== undefined ? Boolean(data.isClient) : true,
        isProvider: data.isProvider !== undefined ? Boolean(data.isProvider) : false,
        isSeller: data.isSeller !== undefined ? Boolean(data.isSeller) : false,
        isCommissionAgent: data.isCommissionAgent !== undefined ? Boolean(data.isCommissionAgent) : false,
        isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
        creditLimit: data.creditLimit !== undefined ? Number(data.creditLimit) : 0.00,
        maxUnpaidInvoices: data.maxUnpaidInvoices !== undefined ? Number(data.maxUnpaidInvoices) : 0.00,
        priceList: data.priceList || 'A',
        discount: data.discount !== undefined ? Number(data.discount) : 0.00,
        paymentTermDays: data.paymentTermDays !== undefined ? Number(data.paymentTermDays) : 30,
        contacts: data.contacts !== undefined ? data.contacts : null,
        sellerId: finalSellerId,
        saleRouteId: data.saleRouteId !== undefined ? (data.saleRouteId !== null ? Number(data.saleRouteId) : null) : null,
        routeSequence: data.routeSequence !== undefined ? (data.routeSequence !== null ? Number(data.routeSequence) : null) : null,
        latitude: data.latitude !== undefined ? (data.latitude !== null ? Number(data.latitude) : null) : null,
        longitude: data.longitude !== undefined ? (data.longitude !== null ? Number(data.longitude) : null) : null,
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
        city: data.city !== undefined ? (data.city !== null ? standardizeCityName(data.city) : null) : undefined,
        province: data.province !== undefined ? data.province : undefined,
        zipCode: data.zipCode !== undefined ? data.zipCode : undefined,
        phone: data.phone !== undefined ? data.phone : undefined,
        email: data.email !== undefined ? data.email : undefined,
        rubro: data.rubro !== undefined ? data.rubro : undefined,
        route: data.route !== undefined ? (data.route !== null ? standardizeRouteName(data.route) : null) : undefined,
        isClient: data.isClient !== undefined ? Boolean(data.isClient) : undefined,
        isProvider: data.isProvider !== undefined ? Boolean(data.isProvider) : undefined,
        isSeller: data.isSeller !== undefined ? Boolean(data.isSeller) : undefined,
        isCommissionAgent: data.isCommissionAgent !== undefined ? Boolean(data.isCommissionAgent) : undefined,
        isActive: data.isActive !== undefined ? Boolean(data.isActive) : undefined,
        creditLimit: data.creditLimit !== undefined ? Number(data.creditLimit) : undefined,
        maxUnpaidInvoices: data.maxUnpaidInvoices !== undefined ? Number(data.maxUnpaidInvoices) : undefined,
        priceList: data.priceList !== undefined ? data.priceList : undefined,
        discount: data.discount !== undefined ? Number(data.discount) : undefined,
        paymentTermDays: data.paymentTermDays !== undefined ? Number(data.paymentTermDays) : undefined,
        contacts: data.contacts !== undefined ? data.contacts : undefined,
        sellerId: finalSellerId,
        saleRouteId: data.saleRouteId !== undefined ? (data.saleRouteId ? Number(data.saleRouteId) : null) : undefined,
        routeSequence: data.routeSequence !== undefined ? (data.routeSequence ? Number(data.routeSequence) : null) : undefined,
        latitude: data.latitude !== undefined ? (data.latitude !== null ? Number(data.latitude) : null) : undefined,
        longitude: data.longitude !== undefined ? (data.longitude !== null ? Number(data.longitude) : null) : undefined,
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
    const { amount, paymentMethod, description, branch, type, supplierInvoiceId, orderId, bankAccountId: reqBankAccountId } = data;
    const selectedBranch = branch || 'X';

    const persona = await prisma.persona.findUnique({ where: { id } });
    if (!persona) throw new Error('Persona no encontrada.');

    if (userRole === Role.VENDEDOR && persona.isClient && persona.sellerId !== userId) {
      throw new Error('Acceso denegado.');
    }

    const paymentAmount = Number(Number(amount).toFixed(2));
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
        let activeDrawer = await tx.cashDrawer.findFirst({
          where: { userId, status: 'OPEN' },
        });

        if (!activeDrawer) {
          activeDrawer = await tx.cashDrawer.findFirst({
            where: { status: 'OPEN' }
          });
        }

        if (!activeDrawer) {
          const user = await tx.user.findUnique({ where: { id: userId } });
          if (user && (user.role === Role.ADMIN || user.role === Role.FACTURACION)) {
            cashDrawerId = null;
          } else {
            throw new Error(`Debés tener una Caja Abierta antes de registrar cobros/pagos en efectivo.`);
          }
        } else {
          cashDrawerId = activeDrawer.id;
        }
      }

      let bankAccountId: number | null = null;
      if (paymentMethod === PaymentMethod.BANK_TRANSFER || paymentMethod === PaymentMethod.CHECK) {
        const selectedBankId = reqBankAccountId ? Number(reqBankAccountId) : (await tx.bankAccount.findFirst())?.id;
        if (!selectedBankId) throw new Error('No hay ninguna cuenta bancaria registrada en el sistema.');
        bankAccountId = selectedBankId;

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
          verified: true, // Cobro/pago administrativo directo en backoffice -> autoverificado
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
      where: { 
        personaId: persona.id,
        OR: [
          { type: TransactionType.OUTCOME },
          { type: TransactionType.INCOME, verified: true }
        ]
      },
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
      where: { 
        personaId: persona.id, 
        type: { in: ['RETENCION_SUFRIDA', 'RETENCION_PRACTICADA'] } 
      },
      orderBy: { date: 'asc' },
    });

    const ledgerItems: any[] = [];

    orders.forEach((o) => {
      ledgerItems.push({
        id: `order-${o.id}`,
        movementId: o.movementId,
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
        movementId: t.movementId,
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
        movementId: si.movementId,
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
        movementId: cn.movementId,
        date: cn.createdAt,
        type: 'CREDIT',
        reference: `Nota de Crédito #${cn.id}`,
        description: `${cn.creditNoteType.replace(/_/g, ' ')} ${cn.creditNoteNumber || 'INT-' + cn.id.toString().padStart(8, '0')} (${cn.reason})`,
        amount: Number(cn.totalAmount),
      });
    });

    withholdings.forEach((w) => {
      const type = w.type === 'RETENCION_PRACTICADA' ? 'DEBIT' : 'CREDIT';
      ledgerItems.push({
        id: `withholding-${w.id}`,
        movementId: w.movementId,
        date: w.date,
        type: type,
        reference: `${w.type === 'RETENCION_PRACTICADA' ? 'Retención Practicada' : 'Retención Sufrida'} Cert. Nro ${w.number}`,
        description: `${w.type === 'RETENCION_PRACTICADA' ? 'Retención Emitida' : 'Retención Recibida'} - ${w.taxType === 'IIBB' ? 'IIBB' : 'Ganancias'}`,
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
   * Auditoría de saldos: compara outstandingBalance con el resultado del Ledger para todas las personas.
   */
  async checkAllBalances() {
    const personas = await prisma.persona.findMany({
      where: { isActive: true }
    });

    const mismatches = [];

    for (const p of personas) {
      // Usar getPersonaLedger con el rol ADMIN para evitar denegación de acceso en preventistas
      const ledgerData = await this.getPersonaLedger(p.id, 0, 'ADMIN');
      
      // El saldo teórico es el balance de la última línea del Ledger, o 0 si no hay movimientos.
      const theoretical = ledgerData.ledger.length > 0 
        ? ledgerData.ledger[ledgerData.ledger.length - 1].balance 
        : 0;
        
      const actual = Number(p.outstandingBalance || 0);
      const diff = actual - theoretical;

      // Reportar si la diferencia absoluta es mayor a 0.05 (tolerancia de centavos por redondeos)
      if (Math.abs(diff) > 0.05) {
        mismatches.push({
          id: p.id,
          name: p.name,
          isClient: p.isClient,
          isProvider: p.isProvider,
          actual: Math.round(actual * 100) / 100,
          theoretical: Math.round(theoretical * 100) / 100,
          diff: Math.round(diff * 100) / 100
        });
      }
    }

    return mismatches;
  }

  /**
   * Conciliar el saldo de una persona específica basándose en su Ledger.
   */
  async reconcileBalance(personaId: number) {
    const persona = await prisma.persona.findUnique({ where: { id: personaId } });
    if (!persona) throw new Error('Persona no encontrada.');

    const ledgerData = await this.getPersonaLedger(persona.id, 0, 'ADMIN');
    const theoretical = ledgerData.ledger.length > 0 
      ? ledgerData.ledger[ledgerData.ledger.length - 1].balance 
      : 0;

    const roundedTheoretical = Math.round(theoretical * 100) / 100;

    const updated = await prisma.persona.update({
      where: { id: persona.id },
      data: { outstandingBalance: roundedTheoretical }
    });

    return { persona: updated, theoretical: roundedTheoretical };
  }

  /**
   * Conciliar masivamente todas las personas con descuadre contable.
   */
  async reconcileAllBalances() {
    const mismatches = await this.checkAllBalances();
    const results = [];

    for (const m of mismatches) {
      const res = await this.reconcileBalance(m.id);
      results.push(res.persona);
    }

    return results;
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
   * Calcula la cantidad exacta de boletas impagas de un cliente aplicando FIFO global.
   */
  async getPersonaPendingInvoicesCount(id: number) {
    const client = await prisma.persona.findUnique({
      where: { id },
      include: {
        orders: {
          where: { status: OrderStatus.DELIVERED },
          include: {
            transactions: { where: { type: TransactionType.INCOME } },
            creditNotes: true
          },
          orderBy: { createdAt: 'asc' }
        },
        transactions: {
          where: { type: TransactionType.INCOME, orderId: null }
        },
        creditNotes: {
          where: { orderId: null }
        }
      }
    });

    if (!client) return 0;
    if (Number(client.outstandingBalance) <= 0) return 0;

    const officialOrders = client.orders.filter(o => o.billingType === BillingType.OFFICIAL);
    const internalOrders = client.orders.filter(o => o.billingType === BillingType.INTERNAL);

    const totalOfficialCredit = client.transactions.filter(t => t.billingType === BillingType.OFFICIAL).reduce((acc, t) => acc + Number(t.amount), 0) +
                                client.creditNotes.filter(cn => cn.billingType === BillingType.OFFICIAL).reduce((acc, cn) => acc + Number(cn.totalAmount), 0);

    const totalInternalCredit = client.transactions.filter(t => t.billingType === BillingType.INTERNAL).reduce((acc, t) => acc + Number(t.amount), 0) +
                                client.creditNotes.filter(cn => cn.billingType === BillingType.INTERNAL).reduce((acc, cn) => acc + Number(cn.totalAmount), 0);

    const calculateFIFO = (orders: typeof client.orders, unallocatedCredit: number) => {
      let pool = unallocatedCredit;
      let pendingInvoicesCount = 0;
      orders.forEach(order => {
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
        if (debt > 0.5) pendingInvoicesCount++;
      });
      return pendingInvoicesCount;
    };

    return calculateFIFO(officialOrders, totalOfficialCredit) + calculateFIFO(internalOrders, totalInternalCredit);
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
    const availableCities = [...OFFICIAL_CITIES, 'OTRAS'].sort();

    // Obtener preventistas
    const sellers = await prisma.user.findMany({
      where: { role: 'VENDEDOR' },
      select: { id: true, username: true }
    });

    return { debtors, availableRoutes, availableCities, availableSellers: sellers };
  }

  /**
   * Obtener todos los vendedores activos de la base de datos.
   */
  async getSellers() {
    return prisma.user.findMany({
      where: {
        role: Role.VENDEDOR,
        isActive: true,
      },
      select: {
        id: true,
        username: true,
      },
      orderBy: {
        username: 'asc',
      },
    });
  }

  /**
   * Registrar una visita fallida (No Venta) para un cliente.
   */
  async recordVisit(id: number, reason: string, notes: string | null | undefined, userId: number, userRole: string) {
    const persona = await prisma.persona.findUnique({ where: { id } });
    if (!persona) throw new Error('Persona no encontrada.');

    if (userRole === Role.VENDEDOR && persona.isClient && persona.sellerId !== userId) {
      throw new Error('Acceso denegado.');
    }

    await logAudit({
      userId,
      action: 'CLIENT_VISIT_FAIL',
      entityType: 'Persona',
      entityId: persona.id,
      newValues: {
        status: 'NO_COMPRO',
        reason,
        notes: notes || null,
        date: new Date()
      }
    });

    return { status: 'success', message: 'Visita registrada con éxito.' };
  }
}

function resolveCity(
  city: string | null | undefined,
  address: string | null | undefined,
  route: string | null | undefined
): string {
  // 1. Intentar con el campo 'city'
  if (city) {
    const norm = getOfficialCityOrOther(city);
    if (norm !== 'OTRAS') return norm;
  }

  // 2. Intentar con el campo 'address'
  if (address) {
    const norm = getOfficialCityOrOther(address);
    if (norm !== 'OTRAS') return norm;
  }

  // 3. Intentar con el campo 'route'
  if (route) {
    const norm = getOfficialCityOrOther(route);
    if (norm !== 'OTRAS') return norm;
  }

  return 'OTRAS';
}

export const personaService = new PersonaService();
