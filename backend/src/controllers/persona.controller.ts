import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { personaService } from '../services/persona.service';

/**
 * Obtener listado de personas con filtros rápidos.
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
    const personas = await personaService.getPersonas(userId, userRole, search as string, role as string);
    res.status(200).json({ status: 'success', data: { personas } });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: 'Error al obtener personas.' });
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
    const persona = await personaService.getPersonaById(Number(id), userId, userRole);
    res.status(200).json({ status: 'success', data: { persona } });
  } catch (error: any) {
    if (error.message === 'Persona no encontrada.') {
      res.status(404).json({ status: 'error', message: error.message });
      return;
    }
    if (error.message === 'Acceso denegado.') {
      res.status(403).json({ status: 'error', message: error.message });
      return;
    }
    res.status(500).json({ status: 'error', message: 'Error al obtener la persona.' });
  }
}

/**
 * Crear una nueva persona.
 */
export async function createPersona(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.id;
  const userRole = req.user?.role;

  if (!userId || !userRole) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return;
  }

  try {
    const persona = await personaService.createPersona(req.body, userId, userRole);
    res.status(201).json({ status: 'success', data: { persona } });
  } catch (error: any) {
    console.error('Error creando persona:', error);
    res.status(500).json({ status: 'error', message: error.message || 'Error al crear la persona.' });
  }
}

/**
 * Actualizar datos de una persona.
 */
export async function updatePersona(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const userId = req.user?.id;
  const userRole = req.user?.role;

  if (!userId || !userRole) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return;
  }

  try {
    const persona = await personaService.updatePersona(Number(id), {
        ...req.body,
        address: req.body.address !== undefined ? req.body.address : undefined,
        city: req.body.city !== undefined ? req.body.city : undefined,
        province: req.body.province !== undefined ? req.body.province : undefined,
        zipCode: req.body.zipCode !== undefined ? req.body.zipCode : undefined,
        phone: req.body.phone !== undefined ? req.body.phone : undefined,
        route: req.body.route !== undefined ? req.body.route : undefined,
    }, userId, userRole);
    res.status(200).json({ status: 'success', data: { persona } });
  } catch (error: any) {
    if (error.message === 'Persona no encontrada.') {
      res.status(404).json({ status: 'error', message: error.message });
      return;
    }
    if (error.message === 'Acceso denegado.') {
      res.status(403).json({ status: 'error', message: error.message });
      return;
    }
    res.status(500).json({ status: 'error', message: error.message || 'Error al actualizar la persona.' });
  }
}

/**
 * Registrar pago/cobro directo en la cuenta corriente de la persona.
 */
export async function recordPersonaPayment(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const userId = req.user?.id;
  const userRole = req.user?.role;

  if (!userId || !userRole) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return;
  }

  try {
    const result = await personaService.recordPersonaPayment(Number(id), req.body, userId, userRole);
    res.status(201).json({ status: 'success', data: result });
  } catch (error: any) {
    console.error('Error registrando pago:', error);
    if (error.message === 'Persona no encontrada.') {
      res.status(404).json({ status: 'error', message: error.message });
      return;
    }
    if (error.message === 'Acceso denegado.') {
      res.status(403).json({ status: 'error', message: error.message });
      return;
    }
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
    const result = await personaService.getPersonaLedger(Number(id), userId, userRole);
    res.status(200).json({ status: 'success', data: result });
  } catch (error: any) {
    console.error('Error obteniendo libro diario:', error);
    if (error.message === 'Persona no encontrada.') {
      res.status(404).json({ status: 'error', message: error.message });
      return;
    }
    if (error.message === 'Acceso denegado.') {
      res.status(403).json({ status: 'error', message: error.message });
      return;
    }
    res.status(500).json({ status: 'error', message: 'Error al obtener el extracto de cuenta.' });
  }
}

/**
 * Obtener datos de AFIP dado un CUIT o DNI
 */
export async function getAfipData(req: AuthenticatedRequest, res: Response): Promise<void> {
  const cuit = req.params.cuit as string;
  const userId = req.user?.id;
  const userRole = req.user?.role;

  if (!userId || !userRole) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return;
  }

  if (!cuit || cuit.trim().length < 8) {
    res.status(400).json({ status: 'error', message: 'CUIT/DNI inválido.' });
    return;
  }

  try {
    // Importación dinámica o local para evitar circular dependencies si las hubiera (no suele haber en controllers)
    const { getPersonDetailsAFIP } = await import('../services/afip.service');
    const data = await getPersonDetailsAFIP(cuit);
    res.status(200).json({ status: 'success', data });
  } catch (error: any) {
    console.error('Error consultando AFIP:', error);
    res.status(500).json({ status: 'error', message: 'Error al consultar datos en AFIP.' });
  }
}

/**
 * Obtener las facturas pendientes de un cliente.
 */
export async function getPersonaPendingInvoices(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const userId = req.user?.id;
  const userRole = req.user?.role;

  if (!userId || !userRole) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return;
  }

  try {
    const invoices = await personaService.getPersonaPendingInvoices(Number(id), userId, userRole);
    res.status(200).json({ status: 'success', data: { invoices } });
  } catch (error: any) {
    console.error('Error obteniendo facturas pendientes:', error);
    if (error.message === 'Persona no encontrada.') {
      res.status(404).json({ status: 'error', message: error.message });
      return;
    }
    if (error.message === 'Acceso denegado.') {
      res.status(403).json({ status: 'error', message: error.message });
      return;
    }
    res.status(500).json({ status: 'error', message: 'Error al obtener facturas pendientes.' });
  }
}

/**
 * Obtener reporte de deudores por ruta y sucursales.
 */
export async function getDebtorsReport(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.id;
  const userRole = req.user?.role;

  if (!userId || !userRole) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return;
  }

  try {
    const result = await personaService.getDebtorsReport(userId, userRole);
    res.status(200).json({ status: 'success', data: result });
  } catch (error: any) {
    console.error('Error obteniendo reporte de deudores:', error);
    res.status(500).json({ status: 'error', message: 'Error al obtener el reporte de deudores.' });
  }
}

/**
 * Obtener listado de vendedores activos.
 */
export async function getSellers(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return;
  }

  try {
    const sellers = await personaService.getSellers();
    res.status(200).json({ status: 'success', data: { sellers } });
  } catch (error: any) {
    console.error('Error obteniendo vendedores:', error);
    res.status(500).json({ status: 'error', message: 'Error al obtener vendedores.' });
  }
}

/**
 * Obtener estadísticas y perfil completo de un vendedor.
 */
export async function getSellerProfileStats(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return;
  }

  try {
    const profileData = await personaService.getSellerProfileStats(Number(id));
    res.status(200).json({ status: 'success', data: profileData });
  } catch (error: any) {
    console.error('Error obteniendo perfil de vendedor:', error);
    res.status(500).json({ status: 'error', message: error.message || 'Error al obtener perfil de vendedor.' });
  }
}

/**
 * Registrar una visita fallida a un cliente (No Venta).
 */
export async function recordVisit(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const userId = req.user?.id;
  const userRole = req.user?.role;
  const { reason, notes } = req.body;

  if (!userId || !userRole) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return;
  }

  try {
    const result = await personaService.recordVisit(Number(id), reason, notes, userId, userRole);
    res.status(201).json(result);
  } catch (error: any) {
    console.error('Error registrando visita fallida:', error);
    if (error.message === 'Persona no encontrada.') {
      res.status(404).json({ status: 'error', message: error.message });
      return;
    }
    if (error.message === 'Acceso denegado.') {
      res.status(403).json({ status: 'error', message: error.message });
      return;
    }
    res.status(500).json({ status: 'error', message: 'Error al registrar visita.' });
  }
}

/**
 * Eliminar una persona.
 */
export async function deletePersona(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const userId = req.user?.id;
  const userRole = req.user?.role;

  if (!userId || !userRole) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return;
  }

  try {
    const result = await personaService.deletePersona(Number(id), userId, userRole);
    res.status(200).json({ status: 'success', data: { result } });
  } catch (error: any) {
    console.error('Error eliminando persona:', error);
    if (error.message === 'Persona no encontrada.') {
      res.status(404).json({ status: 'error', message: error.message });
      return;
    }
    res.status(400).json({ status: 'error', message: error.message || 'Error al eliminar la persona.' });
  }
}
