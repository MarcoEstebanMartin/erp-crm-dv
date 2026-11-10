import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { adminService } from '../services/admin.service';
import { personaService } from '../services/persona.service';
import fs from 'fs';
import path from 'path';

export async function getFinancialReports(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { year, month } = req.query;
  try {
    const report = await adminService.getFinancialReports(
      year ? Number(year) : undefined,
      month ? Number(month) : undefined,
    );
    res.status(200).json({ status: 'success', data: { report } });
  } catch (error: any) {
    console.error('Error al procesar reporte financiero:', error);
    res.status(500).json({ status: 'error', message: 'Error al procesar el reporte financiero.' });
  }
}

export async function getSalesChannelStats(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { year, month } = req.query;
  try {
    const report = await adminService.getSalesChannelStats(
      year ? Number(year) : undefined,
      month ? Number(month) : undefined,
    );
    res.status(200).json({ status: 'success', data: report });
  } catch (error: any) {
    console.error('Error al procesar estadísticas de canales de venta:', error);
    res.status(500).json({ status: 'error', message: 'Error al procesar las estadísticas de canales de venta.' });
  }
}

export async function getAuditLogs(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { page = 1, limit = 50 } = req.query;
  try {
    const result = await adminService.getAuditLogs(Number(page), Number(limit));
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

export async function updateConfig(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { ignoreStockCheck } = req.body;
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      let envContent = fs.readFileSync(envPath, 'utf8');
      if (ignoreStockCheck !== undefined) {
        const val = ignoreStockCheck ? 'true' : 'false';
        if (envContent.includes('IGNORE_STOCK_CHECK=')) {
          envContent = envContent.replace(/IGNORE_STOCK_CHECK=.*/g, `IGNORE_STOCK_CHECK="${val}"`);
        } else {
          envContent += `\nIGNORE_STOCK_CHECK="${val}"`;
        }
        process.env.IGNORE_STOCK_CHECK = val;
      }
      fs.writeFileSync(envPath, envContent);
    }
    res.status(200).json({ status: 'success', data: { ignoreStockCheck } });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: 'Error al actualizar configuración.' });
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

export async function getWeeklyReports(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const reports = await adminService.getWeeklyReports();
    res.status(200).json({ status: 'success', data: reports });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: 'Error al obtener reportes semanales.' });
  }
}

export async function saveWeeklyReport(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const report = await adminService.saveWeeklyReport(req.body);
    res.status(200).json({ status: 'success', data: report });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: 'Error al guardar el reporte semanal.' });
  }
}

export async function deleteWeeklyReport(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    await adminService.deleteWeeklyReport(String(req.params.weekStart));
    res.status(200).json({ status: 'success', message: 'Reporte semanal eliminado correctamente.' });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: 'Error al eliminar el reporte semanal.' });
  }
}

export async function getSuggestedCredit(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { weekStart } = req.query;
  if (!weekStart) {
    res.status(400).json({ status: 'error', message: 'Falta especificar el parámetro weekStart.' });
    return;
  }
  try {
    const suggested = await adminService.getSuggestedCreditForWeek(String(weekStart));
    res.status(200).json({ status: 'success', data: { suggested } });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: 'Error al calcular crédito sugerido.' });
  }
}

export async function getAutofillSales(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { weekStart } = req.query;
  if (!weekStart) {
    res.status(400).json({ status: 'error', message: 'Falta especificar el parámetro weekStart.' });
    return;
  }
  try {
    const sales = await adminService.getAutofillSalesForWeek(String(weekStart));
    res.status(200).json({ status: 'success', data: sales });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: 'Error al autocompletar ventas.' });
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
