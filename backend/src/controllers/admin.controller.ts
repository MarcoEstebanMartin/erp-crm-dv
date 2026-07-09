import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { adminService } from '../services/admin.service';
import fs from 'fs';
import path from 'path';

/**
 * Obtener reporte consolidado financiero (Solo ADMIN).
 */
export async function getFinancialReports(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const report = await adminService.getFinancialReports();
    res.status(200).json({ status: 'success', data: { report } });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: 'Error al procesar el reporte financiero.' });
  }
}

/**
 * Obtener logs de auditoría (Solo ADMIN).
 */
export async function getAuditLogs(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { page = 1, limit = 50 } = req.query;
  try {
    const result = await adminService.getAuditLogs(Number(page), Number(limit));
    res.status(200).json({ status: 'success', data: result });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: 'Error al obtener los registros de auditoría.' });
  }
}

/**
 * Obtener listado de usuarios (Solo ADMIN).
 */
export async function getUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const users = await adminService.getUsers();
    res.status(200).json({ status: 'success', data: { users } });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: 'Error al obtener usuarios.' });
  }
}

/**
 * Crear un nuevo usuario (Solo ADMIN).
 */
export async function createUser(req: AuthenticatedRequest, res: Response): Promise<void> {
  const adminId = req.user?.id;
  try {
    const user = await adminService.createUser(req.body, adminId);
    res.status(201).json({ status: 'success', data: { user } });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message || 'Error al crear el usuario.' });
  }
}

/**
 * Habilitar/Deshabilitar usuario (Solo ADMIN).
 */
export async function toggleUserStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const adminId = req.user?.id;
  try {
    const user = await adminService.toggleUserStatus(Number(id), adminId);
    res.status(200).json({ status: 'success', data: { user } });
  } catch (error: any) {
    if (error.message === 'Usuario no encontrado.') {
      res.status(404).json({ status: 'error', message: error.message });
      return;
    }
    res.status(400).json({ status: 'error', message: error.message || 'Error al modificar el estado del usuario.' });
  }
}

/**
 * Actualizar configuracion global del sistema (Solo ADMIN).
 */
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

/**
 * Obtener reportes por zonas.
 */
export async function getZoneReports(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { sellerId, city, cities, startDate, endDate } = req.query;
  
  try {
    let citiesList: string[] | undefined = undefined;
    if (cities) {
      citiesList = String(cities).split(',').map(c => c.trim()).filter(Boolean);
    }

    const filters = {
      sellerId: sellerId ? Number(sellerId) : undefined,
      city: city ? String(city) : undefined,
      cities: citiesList,
      startDate: startDate ? String(startDate) : undefined,
      endDate: endDate ? String(endDate) : undefined
    };
    
    const result = await adminService.getZoneReports(filters);
    res.status(200).json({ status: 'success', data: result });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: 'Error al obtener reportes por zona.' });
  }
}

/**
 * Obtener listado de reportes semanales consolidado.
 */
export async function getWeeklyReports(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const reports = await adminService.getWeeklyReports();
    res.status(200).json({ status: 'success', data: reports });
  } catch (error: any) {
    console.error('Error al obtener reportes semanales:', error);
    res.status(500).json({ status: 'error', message: 'Error al obtener reportes semanales.' });
  }
}

/**
 * Guardar o actualizar reporte semanal.
 */
export async function saveWeeklyReport(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { weekStart, purchases, sales, credit, buffer } = req.body;
  try {
    const report = await adminService.saveWeeklyReport({
      weekStart,
      purchases,
      sales,
      credit,
      buffer
    });
    res.status(200).json({ status: 'success', data: report });
  } catch (error: any) {
    console.error('Error al guardar reporte semanal:', error);
    res.status(500).json({ status: 'error', message: 'Error al guardar el reporte semanal.' });
  }
}

/**
 * Eliminar un reporte semanal.
 */
export async function deleteWeeklyReport(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { weekStart } = req.params;
  try {
    await adminService.deleteWeeklyReport(String(weekStart));
    res.status(200).json({ status: 'success', message: 'Reporte semanal eliminado correctamente.' });
  } catch (error: any) {
    console.error('Error al eliminar reporte semanal:', error);
    res.status(500).json({ status: 'error', message: 'Error al eliminar el reporte semanal.' });
  }
}

/**
 * Obtener el crédito sugerido para una semana específica en base a la anterior.
 */
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
    console.error('Error al calcular crédito sugerido:', error);
    res.status(500).json({ status: 'error', message: 'Error al calcular crédito sugerido.' });
  }
}

/**
 * Obtener las ventas calculadas automáticamente desde el ERP para una semana específica.
 */
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
    console.error('Error al autocompletar ventas:', error);
    res.status(500).json({ status: 'error', message: 'Error al autocompletar ventas.' });
  }
}


