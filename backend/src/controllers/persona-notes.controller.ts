import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { personaNotesSubService } from '../services/personas/persona-notes.service';

function handleNoteError(res: Response, error: any, fallbackMessage: string) {
  if (error?.message === 'Persona no encontrada.' || error?.message === 'Nota no encontrada.') {
    res.status(404).json({ status: 'error', message: error.message });
    return;
  }
  res.status(500).json({ status: 'error', message: error?.message || fallbackMessage });
}

export async function getPersonaNotes(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const notes = await personaNotesSubService.getNotes(Number(req.params.id));
    res.status(200).json({ status: 'success', data: { notes } });
  } catch (error: any) {
    handleNoteError(res, error, 'Error al obtener las notas internas.');
  }
}

export async function createPersonaNote(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return;
  }

  try {
    const note = await personaNotesSubService.createNote(Number(req.params.id), userId, req.body);
    res.status(201).json({ status: 'success', data: { note } });
  } catch (error: any) {
    handleNoteError(res, error, 'Error al guardar la nota interna.');
  }
}

export async function togglePinPersonaNote(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return;
  }

  try {
    const note = await personaNotesSubService.togglePinNote(
      Number(req.params.id),
      Number(req.params.noteId),
      userId,
    );
    res.status(200).json({ status: 'success', data: { note } });
  } catch (error: any) {
    handleNoteError(res, error, 'Error al fijar o desfijar la nota.');
  }
}

export async function deletePersonaNote(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return;
  }

  try {
    const result = await personaNotesSubService.deleteNote(
      Number(req.params.id),
      Number(req.params.noteId),
      userId,
    );
    res.status(200).json({ status: 'success', data: result });
  } catch (error: any) {
    handleNoteError(res, error, 'Error al eliminar la nota interna.');
  }
}

export async function updatePersonaTrustTags(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return;
  }

  try {
    const result = await personaNotesSubService.updateTrustTags(
      Number(req.params.id),
      req.body.trustTags,
      userId,
    );
    res.status(200).json({ status: 'success', data: result });
  } catch (error: any) {
    handleNoteError(res, error, 'Error al actualizar las etiquetas de confianza.');
  }
}
