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
    res.status(500).json({ status: 'error', message: 'Error al crear la persona.' });
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
    const persona = await personaService.updatePersona(Number(id), req.body, userId, userRole);
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
    res.status(500).json({ status: 'error', message: 'Error al actualizar la persona.' });
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
