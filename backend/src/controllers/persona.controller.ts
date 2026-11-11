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
  const cleanDigits = (cuit || '').replace(/\D/g, '');
  if (cleanDigits.length < 7 || cleanDigits.length > 11) {
    res.status(400).json({
      status: 'error',
      message: 'Ingresá un DNI válido (7 u 8 dígitos) o un CUIT completo (11 dígitos).',
    });
    return;
  }

  try {
    const { lookupTaxpayerByCuitOrDni, ArcaValidationError } = await import(
      '../services/arca-padron.service'
    );
    try {
      const data = await lookupTaxpayerByCuitOrDni(cleanDigits);
      res.status(200).json({ status: 'success', data });
    } catch (innerErr: any) {
      if (innerErr instanceof ArcaValidationError) {
        res.status(innerErr.statusCode).json({ status: 'error', message: innerErr.message });
        return;
      }
      throw innerErr;
    }
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: error?.message || 'Error al consultar el padrón fiscal.',
    });
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
  if (!req.user?.id || !req.user?.role) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return;
  }

  const targetSellerId = Number(req.params.id);
  const isAdminOrBilling = req.user.role === 'ADMIN' || req.user.role === 'FACTURACION';
  if (!isAdminOrBilling && req.user.id !== targetSellerId) {
    res.status(403).json({ status: 'error', message: 'Acceso denegado al perfil de otro vendedor.' });
    return;
  }

  try {
    const profileData = await personaService.getSellerProfileStats(targetSellerId);
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
