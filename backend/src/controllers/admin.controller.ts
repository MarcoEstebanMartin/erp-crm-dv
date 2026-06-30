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
