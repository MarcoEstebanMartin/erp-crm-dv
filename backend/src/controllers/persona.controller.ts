import { Response } from 'express';
import prisma from '../utils/prisma';
import { AuthenticatedRequest } from '../types';
import { Role, PaymentMethod, TransactionType, BillingType } from '@prisma/client';
import { logAudit } from '../utils/audit';

/**
 * Obtener listado de personas con filtros rápidos.
 * - ADMIN / DEPOSITO: Ven todas las personas.
 * - VENDEDOR: Solo ve las personas asignadas (cuando actúan como cliente).
 */
export async function getPersonas(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.id;
  const userRole = req.user?.role;
  const { search, role } = req.query;

  if (!userId || !userRole) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return;
  }

  try {
    const whereClause: any = {};

    // Filtro por rol del usuario logueado (Vendedores solo ven sus clientes)
    if (userRole === Role.VENDEDOR) {
      whereClause.sellerId = userId;
    }

    // Filtro de rol de persona solicitado
    if (role === 'client') {
      whereClause.isClient = true;
    } else if (role === 'provider') {
      whereClause.isProvider = true;
    } else if (role === 'seller') {
      whereClause.isSeller = true;
    } else if (role === 'commission') {
      whereClause.isCommissionAgent = true;
    }

    // Filtro de búsqueda por nombre o CUIT
    if (search) {
      whereClause.OR = [
        { name: { contains: String(search), mode: 'insensitive' } },
        { cuit: { contains: String(search), mode: 'insensitive' } },
      ];
    }

    const personas = await prisma.persona.findMany({
      where: whereClause,
      include: {
        seller: {
          select: {
            id: true,
            username: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    res.status(200).json({
      status: 'success',
      data: { personas },
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener personas.',
    });
  }
}

/**
 * Obtener una persona específica por ID.
 */
export async function getPersonaById(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const userId = req.user?.id;
  const userRole = req.user?.role;

  if (!userId || !userRole) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return;
  }

  try {
    const persona = await prisma.persona.findUnique({
      where: { id: Number(id) },
      include: {
        seller: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    if (!persona) {
      res.status(404).json({
        status: 'error',
        message: 'Persona no encontrada.',
      });
      return;
    }

    // Un vendedor no puede ver clientes de otros vendedores
    if (userRole === Role.VENDEDOR && persona.isClient && persona.sellerId !== userId) {
      res.status(403).json({
        status: 'error',
        message: 'Acceso denegado.',
      });
      return;
    }

    res.status(200).json({
      status: 'success',
      data: { persona },
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener la persona.',
    });
  }
}

/**
 * Crear una nueva persona.
 */
export async function createPersona(req: AuthenticatedRequest, res: Response): Promise<void> {
  const {
    name, cuit, address, city, phone, email,
    isClient, isProvider, isSeller, isCommissionAgent,
    creditLimit, priceList, discount, contacts, sellerId
  } = req.body;
  const userId = req.user?.id;
  const userRole = req.user?.role;

  if (!userId || !userRole) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return;
  }

  if (!name) {
    res.status(400).json({
      status: 'error',
      message: 'El nombre o razón social es requerido.',
    });
    return;
  }

  try {
    let finalSellerId = sellerId ? Number(sellerId) : null;
    if (userRole === Role.VENDEDOR) {
      finalSellerId = userId;
    }

    const persona = await prisma.persona.create({
      data: {
        name,
        cuit,
        address,
        city,
        phone,
        email,
        isClient: isClient !== undefined ? Boolean(isClient) : true,
        isProvider: isProvider !== undefined ? Boolean(isProvider) : false,
        isSeller: isSeller !== undefined ? Boolean(isSeller) : false,
        isCommissionAgent: isCommissionAgent !== undefined ? Boolean(isCommissionAgent) : false,
        creditLimit: creditLimit !== undefined ? Number(creditLimit) : 0.00,
        priceList: priceList || 'A',
        discount: discount !== undefined ? Number(discount) : 0.00,
        contacts: contacts !== undefined ? contacts : null,
        sellerId: finalSellerId,
      },
    });

    // Auditoría
    await logAudit({
      userId,
      action: 'CREATE_PERSONA',
      entityType: 'Persona',
      entityId: persona.id,
      newValues: persona,
    });

    res.status(201).json({
      status: 'success',
      data: { persona },
    });
  } catch (error: any) {
    console.error('Error creando persona:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al crear la persona.',
    });
  }
}

/**
 * Actualizar datos de una persona.
 */
export async function updatePersona(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const {
    name, cuit, address, city, phone, email,
    isClient, isProvider, isSeller, isCommissionAgent,
    creditLimit, priceList, discount, contacts, sellerId
  } = req.body;
  const userId = req.user?.id;
  const userRole = req.user?.role;

  if (!userId || !userRole) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return;
  }

  try {
    const original = await prisma.persona.findUnique({
      where: { id: Number(id) },
    });

    if (!original) {
      res.status(404).json({
        status: 'error',
        message: 'Persona no encontrada.',
      });
      return;
    }

    if (userRole === Role.VENDEDOR && original.isClient && original.sellerId !== userId) {
      res.status(403).json({
        status: 'error',
        message: 'Acceso denegado.',
      });
      return;
    }

    let finalSellerId = original.sellerId;
    if (userRole === Role.ADMIN && sellerId !== undefined) {
      finalSellerId = sellerId ? Number(sellerId) : null;
    }

    const updated = await prisma.persona.update({
      where: { id: Number(id) },
      data: {
        name: name !== undefined ? name : undefined,
        cuit: cuit !== undefined ? cuit : undefined,
        address: address !== undefined ? address : undefined,
        city: city !== undefined ? city : undefined,
        phone: phone !== undefined ? phone : undefined,
        email: email !== undefined ? email : undefined,
        isClient: isClient !== undefined ? Boolean(isClient) : undefined,
        isProvider: isProvider !== undefined ? Boolean(isProvider) : undefined,
        isSeller: isSeller !== undefined ? Boolean(isSeller) : undefined,
        isCommissionAgent: isCommissionAgent !== undefined ? Boolean(isCommissionAgent) : undefined,
        creditLimit: creditLimit !== undefined ? Number(creditLimit) : undefined,
        priceList: priceList !== undefined ? priceList : undefined,
        discount: discount !== undefined ? Number(discount) : undefined,
        contacts: contacts !== undefined ? contacts : undefined,
        sellerId: finalSellerId,
      },
    });

    // Auditoría
    await logAudit({
      userId,
      action: 'UPDATE_PERSONA',
      entityType: 'Persona',
      entityId: updated.id,
      oldValues: original,
      newValues: updated,
    });

    res.status(200).json({
      status: 'success',
      data: { persona: updated },
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: 'Error al actualizar la persona.',
    });
  }
}

/**
 * Registrar pago/cobro directo en la cuenta corriente de la persona.
 */
export async function recordPersonaPayment(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const { amount, paymentMethod, description, branch } = req.body;
  const userId = req.user?.id;
  const userRole = req.user?.role;

  if (!userId || !userRole) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return;
  }

  if (!amount || Number(amount) <= 0) {
    res.status(400).json({ status: 'error', message: 'El monto debe ser mayor a cero.' });
    return;
  }

  if (!paymentMethod || !Object.values(PaymentMethod).includes(paymentMethod)) {
    res.status(400).json({ status: 'error', message: 'El método de pago es requerido o no es válido.' });
    return;
  }

  const selectedBranch = branch || 'X'; // Sucursal X por defecto para movimientos CC directos

  try {
    const persona = await prisma.persona.findUnique({ where: { id: Number(id) } });
    if (!persona) {
      res.status(404).json({ status: 'error', message: 'Persona no encontrada.' });
      return;
    }

    if (userRole === Role.VENDEDOR && persona.isClient && persona.sellerId !== userId) {
      res.status(403).json({ status: 'error', message: 'Acceso denegado.' });
      return;
    }

    const paymentAmount = Number(amount);
    const isSupplier = persona.isProvider && !persona.isClient; // Si es proveedor neto, es egreso
    const type = isSupplier ? TransactionType.OUTCOME : TransactionType.INCOME;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Validar e impactar Caja Operativa si es efectivo
      let cashDrawerId: number | null = null;
      if (paymentMethod === PaymentMethod.CASH) {
        const activeDrawer = await tx.cashDrawer.findFirst({
          where: {
            userId,
            status: 'OPEN',
            branch: selectedBranch,
          },
        });
        if (!activeDrawer) {
          throw new Error(`Debés tener una caja abierta para la Sucursal ${selectedBranch} antes de registrar cobros/pagos en efectivo.`);
        }
        cashDrawerId = activeDrawer.id;
      }

      // 2. Validar e impactar Banco si es transferencia o cheque
      let bankAccountId: number | null = null;
      if (paymentMethod === PaymentMethod.BANK_TRANSFER || paymentMethod === PaymentMethod.CHECK) {
        const bankAcc = await tx.bankAccount.findFirst(); // Toma el primer banco por defecto
        if (!bankAcc) {
          throw new Error('No hay ninguna cuenta bancaria registrada en el sistema.');
        }
        bankAccountId = bankAcc.id;

        // Actualizar saldo de banco: aumenta para INCOME, disminuye para OUTCOME
        await tx.bankAccount.update({
          where: { id: bankAccountId },
          data: {
            balance: {
              increment: type === TransactionType.INCOME ? paymentAmount : -paymentAmount,
            },
          },
        });
      }

      // 3. Crear transacción
      const transaction = await tx.transaction.create({
        data: {
          personaId: persona.id,
          userId,
          billingType: selectedBranch === 'A' ? BillingType.OFFICIAL : BillingType.INTERNAL,
          type,
          paymentMethod: paymentMethod as PaymentMethod,
          amount: paymentAmount,
          description: description || `${isSupplier ? 'Pago' : 'Cobro'} en cuenta corriente de ${persona.name}`,
          cashDrawerId,
          bankAccountId,
        },
      });

      // 4. Actualizar saldo neto de Cuenta Corriente
      // INCOME (cobro): decrementa outstandingBalance (nos debe menos)
      // OUTCOME (pago): incrementa outstandingBalance (le debemos menos)
      const updatedPersona = await tx.persona.update({
        where: { id: persona.id },
        data: {
          outstandingBalance: {
            decrement: type === TransactionType.INCOME ? paymentAmount : -paymentAmount,
          },
        },
      });

      return { transaction, updatedPersona };
    });

    // Auditoría
    await logAudit({
      userId,
      action: 'RECORD_PERSONA_PAYMENT',
      entityType: 'Persona',
      entityId: persona.id,
      newValues: {
        transactionId: result.transaction.id,
        amount: paymentAmount,
        type,
        newOutstandingBalance: result.updatedPersona.outstandingBalance.toString(),
      },
    });

    res.status(201).json({
      status: 'success',
      data: {
        transaction: result.transaction,
        persona: result.updatedPersona,
      },
    });

  } catch (error: any) {
    console.error('Error registrando pago:', error);
    res.status(400).json({ status: 'error', message: error.message || 'Error al registrar el cobro.' });
  }
}

/**
 * Obtener libro diario (Ledger) de cuenta corriente de la persona.
 */
export async function getPersonaLedger(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const userId = req.user?.id;
  const userRole = req.user?.role;

  if (!userId || !userRole) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return;
  }

  try {
    const persona = await prisma.persona.findUnique({
      where: { id: Number(id) },
    });

    if (!persona) {
      res.status(404).json({ status: 'error', message: 'Persona no encontrada.' });
      return;
    }

    if (userRole === Role.VENDEDOR && persona.isClient && persona.sellerId !== userId) {
      res.status(403).json({ status: 'error', message: 'Acceso denegado.' });
      return;
    }

    // 1. Pedidos (débito para cliente)
    const orders = await prisma.order.findMany({
      where: {
        personaId: persona.id,
        status: 'DELIVERED',
      },
      orderBy: { createdAt: 'asc' },
    });

    // 2. Transacciones (INCOME = crédito cliente, OUTCOME = débito proveedor)
    const transactions = await prisma.transaction.findMany({
      where: {
        personaId: persona.id,
      },
      orderBy: { createdAt: 'asc' },
    });

    const ledgerItems: any[] = [];

    // Pedidos actúan como deudas a cobrar (DEBIT)
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
      // Si la transacción es INCOME (ingreso para nosotros, cobro al cliente): es un CREDIT
      // Si es OUTCOME (egreso para nosotros, pago al proveedor): es un DEBIT (disminuye deuda con proveedor)
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

    // Ordenar cronológicamente
    ledgerItems.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calcular saldo evolutivo
    let runningBalance = 0;
    const ledger = ledgerItems.map((item) => {
      if (item.type === 'DEBIT') {
        runningBalance += item.amount;
      } else {
        runningBalance -= item.amount;
      }
      return {
        ...item,
        balance: runningBalance,
      };
    });

    res.status(200).json({
      status: 'success',
      data: {
        persona,
        ledger,
      },
    });
  } catch (error: any) {
    console.error('Error obteniendo libro diario:', error);
    res.status(500).json({ status: 'error', message: 'Error al obtener el extracto de cuenta.' });
  }
}
