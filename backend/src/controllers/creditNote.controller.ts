import { Response } from 'express';
import { Role } from '@prisma/client';
import { AuthenticatedRequest } from '../types';
import AppError from '../utils/AppError';
import { creditNoteService } from '../services/credit-notes/credit-note.service';
import { creditNoteApprovalService } from '../services/credit-notes/credit-note-approval.service';

function handleCreditNoteError(res: Response, error: unknown, fallbackMessage: string): void {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({ status: 'error', message: error.message });
    return;
  }
  console.error(fallbackMessage, error);
  res.status(500).json({ status: 'error', message: fallbackMessage });
}

export async function getCreditNotes(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const creditNotes = await creditNoteService.getCreditNotes(
      req.query as Record<string, string>,
    );
    res.status(200).json({ status: 'success', data: { creditNotes } });
  } catch (error) {
    handleCreditNoteError(res, error, 'Error al obtener las notas de crédito.');
  }
}

export async function createCreditNote(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user?.id) {
    res.status(401).json({ status: 'error', message: 'No autenticado.' });
    return;
  }
  try {
    const creditNote = await creditNoteService.createCreditNote({
      userId: req.user.id,
      userRole: req.user.role,
      personaId: Number(req.body.personaId),
      orderId: req.body.orderId ? Number(req.body.orderId) : null,
      billingType: req.body.billingType,
      reason: req.body.reason,
      comments: req.body.comments,
      items: req.body.items,
    });
    res.status(201).json({ status: 'success', data: { creditNote } });
  } catch (error) {
    handleCreditNoteError(res, error, 'Error al guardar la nota de crédito.');
  }
}

export async function getCreditNoteById(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user?.id || !req.user?.role) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return;
  }
  try {
    const creditNote = await creditNoteService.getCreditNoteById(Number(req.params.id));
    res.status(200).json({ status: 'success', data: { creditNote } });
  } catch (error) {
    handleCreditNoteError(res, error, 'Error al obtener la nota de crédito.');
  }
}

export async function approveCreditNote(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user?.id || req.user.role !== Role.ADMIN) {
    res.status(403).json({
      status: 'error',
      message: 'No autorizado. Solo los administradores pueden aprobar notas de crédito.',
    });
    return;
  }
  try {
    const creditNote = await creditNoteApprovalService.approveCreditNote({
      id: Number(req.params.id),
      adminId: req.user.id,
    });
    res.status(200).json({ status: 'success', data: { creditNote } });
  } catch (error) {
    handleCreditNoteError(res, error, 'Error al aprobar la nota de crédito.');
  }
}

export async function rejectCreditNote(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user?.id || req.user.role !== Role.ADMIN) {
    res.status(403).json({
      status: 'error',
      message: 'No autorizado. Solo los administradores pueden rechazar notas de crédito.',
    });
    return;
  }
  try {
    const creditNote = await creditNoteApprovalService.rejectCreditNote({
      id: Number(req.params.id),
      adminId: req.user.id,
    });
    res.status(200).json({ status: 'success', data: { creditNote } });
  } catch (error) {
    handleCreditNoteError(res, error, 'Error al rechazar la nota de crédito.');
  }
}
