import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { personaService } from '../services/persona.service';

function handlePersonaError(res: Response, error: any, fallbackMessage: string, defaultCode = 500) {
  if (error.message === 'Persona no encontrada.') {
    res.status(404).json({ status: 'error', message: error.message });
    return;
  }
  if (error.message === 'Acceso denegado.') {
    res.status(403).json({ status: 'error', message: error.message });
    return;
  }
  res.status(defaultCode).json({ status: 'error', message: error.message || fallbackMessage });
}

export async function getPersonas(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.id;
  const userRole = req.user?.role;
  const { search, role } = req.query;

  if (!userId || !userRole) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return;
  }

  try {
    const personas = await personaService.getPersonas(
      userId,
      userRole,
      search as string,
      role as string,
    );
    res.status(200).json({ status: 'success', data: { personas } });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: 'Error al obtener personas.' });
  }
}

export async function getPersonaById(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.id;
  const userRole = req.user?.role;
  if (!userId || !userRole) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return;
  }

  try {
    const persona = await personaService.getPersonaById(Number(req.params.id), userId, userRole);
    res.status(200).json({ status: 'success', data: { persona } });
  } catch (error: any) {
    handlePersonaError(res, error, 'Error al obtener la persona.');
  }
}

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
    res.status(500).json({ status: 'error', message: error.message || 'Error al crear la persona.' });
  }
}

export async function updatePersona(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.id;
  const userRole = req.user?.role;
  if (!userId || !userRole) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return;
  }

  try {
    const persona = await personaService.updatePersona(
      Number(req.params.id),
      req.body,
      userId,
      userRole,
    );
    res.status(200).json({ status: 'success', data: { persona } });
  } catch (error: any) {
    handlePersonaError(res, error, 'Error al actualizar la persona.');
  }
}

export async function recordPersonaPayment(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = req.user?.id;
  const userRole = req.user?.role;
  if (!userId || !userRole) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return;
  }

  try {
    const result = await personaService.recordPersonaPayment(
      Number(req.params.id),
      req.body,
      userId,
      userRole,
    );
    res.status(201).json({ status: 'success', data: result });
  } catch (error: any) {
    handlePersonaError(res, error, 'Error al registrar el cobro.', 400);
  }
}

export async function getPersonaLedger(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.id;
  const userRole = req.user?.role;
  if (!userId || !userRole) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return;
  }

  try {
    const result = await personaService.getPersonaLedger(Number(req.params.id), userId, userRole);
    res.status(200).json({ status: 'success', data: result });
  } catch (error: any) {
    handlePersonaError(res, error, 'Error al obtener el extracto de cuenta.');
  }
}

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
    const { getPersonDetailsAFIP } = await import('../services/afip.service');
    const data = await getPersonDetailsAFIP(cuit);
    res.status(200).json({ status: 'success', data });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: 'Error al consultar datos en AFIP.' });
  }
}

export async function getPersonaPendingInvoices(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = req.user?.id;
  const userRole = req.user?.role;
  if (!userId || !userRole) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return;
  }

  try {
    const invoices = await personaService.getPersonaPendingInvoices(
      Number(req.params.id),
      userId,
      userRole,
    );
    res.status(200).json({ status: 'success', data: { invoices } });
  } catch (error: any) {
    handlePersonaError(res, error, 'Error al obtener facturas pendientes.');
  }
}

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
    res.status(500).json({ status: 'error', message: 'Error al obtener el reporte de deudores.' });
  }
}

export async function getSellers(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user?.id) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return;
  }

  try {
    const sellers = await personaService.getSellers();
    res.status(200).json({ status: 'success', data: { sellers } });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: 'Error al obtener vendedores.' });
  }
}

export async function getSellerProfileStats(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  if (!req.user?.id) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return;
  }

  try {
    const profileData = await personaService.getSellerProfileStats(Number(req.params.id));
    res.status(200).json({ status: 'success', data: profileData });
  } catch (error: any) {
    res
      .status(500)
      .json({ status: 'error', message: error.message || 'Error al obtener perfil de vendedor.' });
  }
}

export async function recordVisit(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.id;
  const userRole = req.user?.role;
  const { reason, notes } = req.body;
  if (!userId || !userRole) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return;
  }

  try {
    const result = await personaService.recordVisit(
      Number(req.params.id),
      reason,
      notes,
      userId,
      userRole,
    );
    res.status(201).json(result);
  } catch (error: any) {
    handlePersonaError(res, error, 'Error al registrar visita.');
  }
}

export async function deletePersona(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.id;
  const userRole = req.user?.role;
  if (!userId || !userRole) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return;
  }

  try {
    const result = await personaService.deletePersona(Number(req.params.id), userId, userRole);
    res.status(200).json({ status: 'success', data: { result } });
  } catch (error: any) {
    handlePersonaError(res, error, 'Error al eliminar la persona.', 400);
  }
}
