import prisma from '../utils/prisma';
import { logAudit } from '../utils/audit';
import { Role } from '@prisma/client';
import { standardizeCityName, standardizeRouteName } from '../utils/normalize';
import { matchesPhoneticQuery } from '../core/search';
import { personaPaymentSubService } from './personas/persona-payment.service';
import { personaLedgerSubService } from './personas/persona-ledger.service';
import { personaDebtorsSubService } from './personas/persona-debtors.service';
import { personaSellersSubService } from './personas/persona-sellers.service';

export class PersonaService {
  /**
   * Obtener listado de personas con filtros y Buscador Fonético Argentino.
   */
  async getPersonas(userId: number, userRole: string, search?: string, role?: string) {
    const whereClause: any = {};
    if (userRole === Role.VENDEDOR) whereClause.sellerId = userId;
    if (role === 'client') whereClause.isClient = true;
    else if (role === 'provider') whereClause.isProvider = true;
    else if (role === 'seller') whereClause.isSeller = true;
    else if (role === 'commission') whereClause.isCommissionAgent = true;

    let personas = await prisma.persona.findMany({
      where: whereClause,
      include: {
        seller: { select: { id: true, username: true } },
        saleRoute: {
          select: {
            id: true,
            name: true,
            dayOfWeek: true,
            seller: { select: { id: true, username: true } },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    if (search && search.trim()) {
      const q = search.trim();
      personas = personas.filter((p) => {
        const target = `${p.name} ${p.cuit || ''} ${p.city || ''} ${p.barrio || ''} ${p.route || ''} ${p.address || ''} ${p.saleRoute?.name || ''}`;
        return matchesPhoneticQuery(target, q);
      });
    }

    if (role === 'client') {
      try {
        const report = await this.getDebtorsReport(userId, userRole);
        const debtorMap = new Map();
        report.debtors.forEach((d: any) => debtorMap.set(d.id, d.pendingInvoicesCount));
        return personas.map((p) => ({
          ...p,
          pendingInvoicesCount: debtorMap.get(p.id) || 0,
        }));
      } catch (err) {
        console.error('Error fetching debtors report inside getPersonas:', err);
        return personas;
      }
    }

    return personas;
  }

  async getPersonaById(id: number, userId: number, userRole: string) {
    const persona = await prisma.persona.findUnique({
      where: { id },
      include: {
        seller: { select: { id: true, username: true } },
        saleRoute: {
          select: {
            id: true,
            name: true,
            dayOfWeek: true,
            seller: { select: { id: true, username: true } },
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

  private async resolveDefaultOficinaSeller(route?: string | null, saleRouteId?: number | null) {
    const cleanRoute = (route || '').toUpperCase().trim();
    let isOficina = cleanRoute === 'OFICINA';
    if (!isOficina && saleRouteId) {
      const sr = await prisma.saleRoute.findUnique({
        where: { id: saleRouteId },
        select: { name: true },
      });
      if (sr && sr.name.toUpperCase().includes('OFICINA')) isOficina = true;
    }
    if (isOficina) {
      const oficinaUser = await prisma.user.findFirst({ where: { username: 'OFICINA' } });
      return oficinaUser ? oficinaUser.id : null;
    }
    return null;
  }

  async createPersona(data: any, userId: number, userRole: string) {
    let finalSellerId = data.sellerId ? Number(data.sellerId) : null;
    if (userRole === Role.VENDEDOR) {
      finalSellerId = userId;
    } else if (!finalSellerId) {
      finalSellerId = await this.resolveDefaultOficinaSeller(
        data.route,
        data.saleRouteId ? Number(data.saleRouteId) : null,
      );
    }

    const persona = await prisma.persona.create({
      data: {
        name: data.name,
        cuit: data.cuit,
        address: data.address,
        city: data.city != null ? standardizeCityName(data.city) : data.city,
        barrio: data.barrio != null ? String(data.barrio).trim() : null,
        province: data.province,
        zipCode: data.zipCode,
        phone: data.phone,
        email: data.email,
        rubro: data.rubro || null,
        route: data.route != null ? standardizeRouteName(data.route) : data.route,
        isClient: data.isClient !== undefined ? Boolean(data.isClient) : true,
        isProvider: data.isProvider !== undefined ? Boolean(data.isProvider) : false,
        isSeller: data.isSeller !== undefined ? Boolean(data.isSeller) : false,
        isCommissionAgent: data.isCommissionAgent !== undefined ? Boolean(data.isCommissionAgent) : false,
        isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
        creditLimit: data.creditLimit !== undefined ? Number(data.creditLimit) : 0.0,
        maxUnpaidInvoices: data.maxUnpaidInvoices !== undefined ? Number(data.maxUnpaidInvoices) : 0.0,
        priceList: data.priceList || 'A',
        discount: data.discount !== undefined ? Number(data.discount) : 0.0,
        paymentTermDays: data.paymentTermDays !== undefined ? Number(data.paymentTermDays) : 30,
        contacts: data.contacts !== undefined ? data.contacts : null,
        seller: finalSellerId ? { connect: { id: finalSellerId } } : undefined,
        saleRoute: data.saleRouteId ? { connect: { id: Number(data.saleRouteId) } } : undefined,
        routeSequence: data.routeSequence != null ? Number(data.routeSequence) : null,
        latitude: data.latitude != null ? Number(data.latitude) : null,
        longitude: data.longitude != null ? Number(data.longitude) : null,
        webPin: data.webPin != null ? String(data.webPin).trim() : null,
        birthDate: data.birthDate ? new Date(data.birthDate) : null,
      },
    });

    await logAudit({ userId, action: 'CREATE_PERSONA', entityType: 'Persona', entityId: persona.id, newValues: persona });
    return persona;
  }

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

    if (userRole !== Role.VENDEDOR && !finalSellerId) {
      const targetRoute = data.route !== undefined ? (data.route ? standardizeRouteName(data.route) : null) : original.route;
      const targetSaleRouteId = data.saleRouteId !== undefined ? (data.saleRouteId ? Number(data.saleRouteId) : null) : original.saleRouteId;
      finalSellerId = await this.resolveDefaultOficinaSeller(targetRoute, targetSaleRouteId);
    }

    const updated = await prisma.persona.update({
      where: { id },
      data: {
        name: data.name,
        cuit: data.cuit,
        address: data.address,
        city: data.city !== undefined ? (data.city !== null ? standardizeCityName(data.city) : null) : undefined,
        barrio: data.barrio !== undefined ? (data.barrio !== null ? String(data.barrio).trim() : null) : undefined,
        province: data.province,
        zipCode: data.zipCode,
        phone: data.phone,
        email: data.email,
        rubro: data.rubro,
        route: data.route !== undefined ? (data.route !== null ? standardizeRouteName(data.route) : null) : undefined,
        isClient: data.isClient !== undefined ? Boolean(data.isClient) : undefined,
        isProvider: data.isProvider !== undefined ? Boolean(data.isProvider) : undefined,
        isSeller: data.isSeller !== undefined ? Boolean(data.isSeller) : undefined,
        isCommissionAgent: data.isCommissionAgent !== undefined ? Boolean(data.isCommissionAgent) : undefined,
        isActive: data.isActive !== undefined ? Boolean(data.isActive) : undefined,
        creditLimit: data.creditLimit !== undefined ? Number(data.creditLimit) : undefined,
        maxUnpaidInvoices: data.maxUnpaidInvoices !== undefined ? Number(data.maxUnpaidInvoices) : undefined,
        priceList: data.priceList,
        discount: data.discount !== undefined ? Number(data.discount) : undefined,
        paymentTermDays: data.paymentTermDays !== undefined ? Number(data.paymentTermDays) : undefined,
        contacts: data.contacts,
        seller: finalSellerId !== undefined ? (finalSellerId ? { connect: { id: finalSellerId } } : { disconnect: true }) : undefined,
        saleRoute: data.saleRouteId !== undefined ? (data.saleRouteId ? { connect: { id: Number(data.saleRouteId) } } : { disconnect: true }) : undefined,
        routeSequence: data.routeSequence !== undefined ? (data.routeSequence ? Number(data.routeSequence) : null) : undefined,
        latitude: data.latitude !== undefined ? (data.latitude !== null ? Number(data.latitude) : null) : undefined,
        longitude: data.longitude !== undefined ? (data.longitude !== null ? Number(data.longitude) : null) : undefined,
        webPin: data.webPin !== undefined ? (data.webPin ? String(data.webPin).trim() : null) : undefined,
        birthDate: data.birthDate !== undefined ? (data.birthDate ? new Date(data.birthDate) : null) : undefined,
      },
    });

    await logAudit({ userId, action: 'UPDATE_PERSONA', entityType: 'Persona', entityId: updated.id, oldValues: original, newValues: updated });
    return updated;
  }

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
      newValues: { status: 'NO_COMPRO', reason, notes: notes || null, date: new Date() },
    });

    return { status: 'success', message: 'Visita registrada con éxito.' };
  }

  async deletePersona(id: number, userId: number, userRole: string) {
    if (userRole !== Role.ADMIN) throw new Error('Solo los administradores pueden eliminar personas.');
    const persona = await prisma.persona.findUnique({
      where: { id },
      include: {
        transactions: { select: { id: true } },
        orders: { select: { id: true } },
        supplierInvoices: { select: { id: true } },
        creditNotes: { select: { id: true } },
      },
    });
    if (!persona) throw new Error('Persona no encontrada.');
    if (
      persona.transactions.length > 0 ||
      persona.orders.length > 0 ||
      persona.supplierInvoices.length > 0 ||
      persona.creditNotes.length > 0
    ) {
      throw new Error('No se puede eliminar la persona porque tiene movimientos registrados (Órdenes, Transacciones, Notas de Crédito o Facturas).');
    }

    const deleted = await prisma.persona.delete({ where: { id } });
    await logAudit({ userId, action: 'DELETE_PERSONA', entityType: 'Persona', entityId: deleted.id, oldValues: persona });
    return deleted;
  }

  // Delegación a Submódulos Especializados (< 250–300 líneas cada uno)
  recordPersonaPayment = (id: number, data: any, userId: number, userRole: string) =>
    personaPaymentSubService.recordPersonaPayment(id, data, userId, userRole);
  getPersonaLedger = (id: number, userId: number, userRole: string) =>
    personaLedgerSubService.getPersonaLedger(id, userId, userRole);
  checkAllBalances = () => personaLedgerSubService.checkAllBalances();
  reconcileBalance = (personaId: number) => personaLedgerSubService.reconcileBalance(personaId);
  reconcileAllBalances = () => personaLedgerSubService.reconcileAllBalances();
  getPersonaPendingInvoices = (id: number, userId: number, userRole: string) =>
    personaLedgerSubService.getPersonaPendingInvoices(id, userId, userRole);
  getPersonaPendingInvoicesCount = (id: number, dbClient?: any) =>
    personaDebtorsSubService.getPersonaPendingInvoicesCount(id, dbClient);
  getDebtorsReport = (userId: number, userRole: string) =>
    personaDebtorsSubService.getDebtorsReport(userId, userRole);
  getSellers = () => personaSellersSubService.getSellers();
  getSellerProfileStats = (sellerIdParam: number) =>
    personaSellersSubService.getSellerProfileStats(sellerIdParam);
}

export const personaService = new PersonaService();
