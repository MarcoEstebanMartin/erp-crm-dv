import { Response } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticatedRequest } from '../types';
import { env } from '../config/env.config';
import { setStaffSessionCookie } from '../utils/cookie-auth.util';
import { sessionCache } from '../utils/session-cache.util';
import { adminService } from '../services/admin.service';
import { personaService } from '../services/persona.service';
import {
  getSystemConfigSnapshot,
  updateSystemConfig,
} from '../services/admin/system-config.service';
import { AuditModuleKey, AuditStatusKey } from '../validators/admin.validator';

export async function getFinancialReports(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { year, month, startDate, endDate } = req.query;
  try {
    const report = await adminService.getFinancialReports({
      year: year ? Number(year) : undefined,
      month: month ? Number(month) : undefined,
      startDate: typeof startDate === 'string' && startDate.trim() ? startDate.trim() : undefined,
      endDate: typeof endDate === 'string' && endDate.trim() ? endDate.trim() : undefined,
    });
    res.status(200).json({ status: 'success', data: { report } });
  } catch (error: any) {
    console.error('Error al procesar reporte financiero:', error);
    res.status(500).json({ status: 'error', message: 'Error al procesar el reporte financiero.' });
  }
}

export async function getAuditLogs(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { page = 1, limit = 50, search, userId, module, status, startDate, endDate } = req.query;
  try {
    const result = await adminService.getAuditLogs(Number(page) || 1, Number(limit) || 50, {
      search: typeof search === 'string' && search.trim() ? search.trim() : undefined,
      userId: typeof userId === 'string' && userId.trim() ? Number(userId) : undefined,
      module: typeof module === 'string' && module.trim() ? (module.trim() as AuditModuleKey) : undefined,
      status: typeof status === 'string' && status.trim() ? (status.trim() as AuditStatusKey) : undefined,
      startDate: typeof startDate === 'string' && startDate.trim() ? startDate.trim() : undefined,
      endDate: typeof endDate === 'string' && endDate.trim() ? endDate.trim() : undefined,
    });
    res.status(200).json({ status: 'success', data: result });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: 'Error al obtener los registros de auditoría.' });
  }
}

export async function getUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const users = await adminService.getUsers();
    res.status(200).json({ status: 'success', data: { users } });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: 'Error al obtener usuarios.' });
  }
}

export async function createUser(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = await adminService.createUser(req.body, req.user?.id);
    res.status(201).json({ status: 'success', data: { user } });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message || 'Error al crear el usuario.' });
  }
}

export async function toggleUserStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = await adminService.toggleUserStatus(Number(req.params.id), req.user?.id);
    res.status(200).json({ status: 'success', data: { user } });
  } catch (error: any) {
    const status = error.message === 'Usuario no encontrado.' ? 404 : 400;
    res.status(status).json({ status: 'error', message: error.message || 'Error al modificar el estado del usuario.' });
  }
}

export async function updateUser(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = await adminService.updateUser(Number(req.params.id), req.body, req.user?.id);
    if (
      req.user?.id &&
      Number(req.params.id) === req.user.id &&
      typeof req.body?.password === 'string' &&
      req.body.password.trim().length >= 6
    ) {
      const pwdVer = await adminService.getUserPasswordVersion(user.id);
      if (pwdVer) {
        const freshToken = jwt.sign(
          { id: user.id, username: user.username, role: user.role, pwdVer },
          env.JWT_SECRET,
          { expiresIn: '30d' },
        );
        sessionCache.setStaffSession(user.id, {
          id: user.id,
          role: user.role,
          isActive: true,
          pwdVer,
        });
        setStaffSessionCookie(req, res, freshToken);
      }
    }
    res.status(200).json({ status: 'success', data: { user } });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message || 'Error al actualizar usuario.' });
  }
}

export async function deleteUser(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const result = await adminService.deleteUser(String(req.params.username), req.user?.id);
    res.status(200).json({ status: 'success', data: result });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message || 'Error al eliminar usuario.' });
  }
}

export async function getConfig(_req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const snapshot = await getSystemConfigSnapshot({ bypassCache: true });
    res.status(200).json({ status: 'success', data: snapshot });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message || 'Error al obtener configuración.' });
  }
}

export async function updateConfig(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const snapshot = await updateSystemConfig(req.body, req.user?.id, req.ip);
    res.status(200).json({ status: 'success', data: snapshot });
  } catch (error: any) {
    const msg = String(error?.message || '');
    const isClientError =
      msg.includes('CUIT') ||
      msg.includes('DNI') ||
      msg.includes('ARCA') ||
      msg.includes('Punto de Venta') ||
      msg.includes('requerid');
    res.status(isClientError ? 400 : 500).json({
      status: 'error',
      message: error.message || 'Error al actualizar configuración.',
    });
  }
}

export async function getZoneReports(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { sellerId, city, cities, startDate, endDate } = req.query;
  try {
    const citiesList = cities
      ? String(cities)
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean)
      : undefined;

    const result = await adminService.getZoneReports({
      sellerId: sellerId ? Number(sellerId) : undefined,
      city: city ? String(city) : undefined,
      cities: citiesList,
      startDate: startDate ? String(startDate) : undefined,
      endDate: endDate ? String(endDate) : undefined,
    });
    res.status(200).json({ status: 'success', data: result });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: 'Error al obtener reportes por zona.' });
  }
}

export async function checkBalancesReport(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const mismatches = await personaService.checkAllBalances();
    res.status(200).json({ status: 'success', data: { mismatches } });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: 'Error al procesar la auditoría de saldos.' });
  }
}

export async function syncBalances(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { personaId } = req.body;
  try {
    if (personaId) {
      const result = await personaService.reconcileBalance(Number(personaId));
      res.status(200).json({ status: 'success', data: { persona: result.persona, theoretical: result.theoretical } });
    } else {
      const reconciled = await personaService.reconcileAllBalances();
      res.status(200).json({ status: 'success', data: { count: reconciled.length, reconciled } });
    }
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message || 'Error al conciliar saldos.' });
  }
}

export async function getDocumentAuditLogs(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const logs = await adminService.getDocumentAuditLogs(String(req.params.entityType), Number(req.params.entityId));
    res.status(200).json({ status: 'success', data: { logs } });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: 'Error al obtener la auditoría del documento.' });
  }
}

export async function getProfitabilityReport(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { startDate, endDate, sellerId, city, rubroId, billingType } = req.query;
  try {
    const report = await adminService.getProfitabilityReport({
      startDate: startDate ? String(startDate) : undefined,
      endDate: endDate ? String(endDate) : undefined,
      sellerId: sellerId ? Number(sellerId) : undefined,
      city: city ? String(city) : undefined,
      rubroId: rubroId ? Number(rubroId) : undefined,
      billingType: billingType ? String(billingType) : undefined,
    });
    res.status(200).json({ status: 'success', data: report });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: 'Error al generar el reporte de rentabilidad.' });
  }
}

export async function getExecutivePdfReport(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { startDate, endDate } = req.query;
  try {
    const reportData = await adminService.getExecutivePdfReportData(
      startDate ? String(startDate) : undefined,
      endDate ? String(endDate) : undefined,
    );
    res.status(200).json({ status: 'success', data: reportData });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: 'Error al generar el reporte ejecutivo PDF.' });
  }
}

export async function getSellerMeetingPdfReport(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { sellerId } = req.params;
  const { startDate, endDate } = req.query;
  try {
    if (!sellerId) {
      res.status(400).json({ status: 'error', message: 'El ID del vendedor es requerido.' });
      return;
    }
    const reportData = await adminService.getSellerMeetingPdfReportData(
      Number(sellerId),
      startDate ? String(startDate) : undefined,
      endDate ? String(endDate) : undefined,
    );
    res.status(200).json({ status: 'success', data: reportData });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: 'Error al generar el reporte para la reunión.' });
  }
}

export async function getEmployeePdfReport(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { userId } = req.params;
  const { startDate, endDate } = req.query;
  try {
    if (!userId) {
      res.status(400).json({ status: 'error', message: 'El ID del empleado es requerido.' });
      return;
    }
    const reportData = await adminService.getEmployeePdfReportData(
      Number(userId),
      startDate ? String(startDate) : undefined,
      endDate ? String(endDate) : undefined,
    );
    res.status(200).json({ status: 'success', data: reportData });
  } catch (error: any) {
    if (error?.statusCode === 404) {
      res.status(404).json({ status: 'error', message: error.message || 'Empleado no encontrado.' });
      return;
    }
    res.status(500).json({ status: 'error', message: 'Error al generar el reporte de empleado PDF.' });
  }
}
