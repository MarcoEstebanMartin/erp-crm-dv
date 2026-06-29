import prisma from '../utils/prisma';
import { logAudit } from '../utils/audit';
import { Role, PaymentMethod, TransactionType, BillingType } from '@prisma/client';

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
        phone: data.phone,
        email: data.email,
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
        phone: data.phone !== undefined ? data.phone : undefined,
        email: data.email !== undefined ? data.email : undefined,
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
    const { amount, paymentMethod, description, branch, type, supplierInvoiceId } = data;
    const selectedBranch = branch || 'X';

    const persona = await prisma.persona.findUnique({ where: { id } });
    if (!persona) throw new Error('Persona no encontrada.');

    if (userRole === Role.VENDEDOR && persona.isClient && persona.sellerId !== userId) {
      throw new Error('Acceso denegado.');
    }

    const paymentAmount = Number(amount);
    const isSupplier = persona.isProvider && !persona.isClient;
    const resolvedType = (type === 'OUTCOME' || type === 'INCOME') ? (type as TransactionType) : (isSupplier ? TransactionType.OUTCOME : TransactionType.INCOME);

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
            : `${resolvedType === TransactionType.OUTCOME ? 'Pago' : 'Cobro'} en cuenta corriente de ${persona.name}`),
          cashDrawerId,
          bankAccountId,
          supplierInvoiceId: supplierInvoiceId ? Number(supplierInvoiceId) : null,
        },
      });

      const updatedPersona = await tx.persona.update({
        where: { id: persona.id },
        data: {
          outstandingBalance: {
            decrement: resolvedType === TransactionType.INCOME ? paymentAmount : -paymentAmount,
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
    const persona = await prisma.persona.findUnique({ where: { id } });
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
        description: `${t.type === TransactionType.INCOME ? 'Cobro' : 'Pago'} - ${t.paymentMethod} (${t.description || ''})`,
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
}

export const personaService = new PersonaService();
