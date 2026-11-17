import { PersonaNoteCategory, Role } from '@prisma/client';
import prisma from '../../utils/prisma';
import { logAudit } from '../../utils/audit';

export const TRUST_PRIVILEGED_ROLES: readonly string[] = [Role.ADMIN, Role.FACTURACION];

export function canAccessPersonaTrustData(userRole: string): boolean {
  return TRUST_PRIVILEGED_ROLES.includes(userRole);
}

const noteAuthorSelect = {
  id: true,
  username: true,
  role: true,
};

/**
 * Servicio dedicado a etiquetas fijas de confianza y bitácora interna de clientes (ADMIN / FACTURACION).
 */
export class PersonaNotesSubService {
  private async ensurePersonaExists(personaId: number) {
    const persona = await prisma.persona.findUnique({
      where: { id: personaId },
      select: { id: true, name: true, trustTags: true },
    });
    if (!persona) throw new Error('Persona no encontrada.');
    return persona;
  }

  async getNotes(personaId: number) {
    await this.ensurePersonaExists(personaId);
    return prisma.personaNote.findMany({
      where: { personaId },
      include: { author: { select: noteAuthorSelect } },
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async createNote(
    personaId: number,
    authorId: number,
    data: { content: string; category: PersonaNoteCategory; isPinned?: boolean },
  ) {
    await this.ensurePersonaExists(personaId);

    const note = await prisma.personaNote.create({
      data: {
        personaId,
        authorId,
        category: data.category,
        content: data.content.trim(),
        isPinned: Boolean(data.isPinned),
      },
      include: { author: { select: noteAuthorSelect } },
    });

    await logAudit({
      userId: authorId,
      action: 'ADD_PERSONA_NOTE',
      entityType: 'Persona',
      entityId: personaId,
      newValues: { noteId: note.id, category: note.category, isPinned: note.isPinned },
    });

    return note;
  }

  async togglePinNote(personaId: number, noteId: number, userId: number) {
    const existing = await prisma.personaNote.findFirst({
      where: { id: noteId, personaId },
    });
    if (!existing) throw new Error('Nota no encontrada.');

    const updated = await prisma.personaNote.update({
      where: { id: noteId },
      data: { isPinned: !existing.isPinned },
      include: { author: { select: noteAuthorSelect } },
    });

    await logAudit({
      userId,
      action: 'TOGGLE_PIN_PERSONA_NOTE',
      entityType: 'Persona',
      entityId: personaId,
      oldValues: { noteId, isPinned: existing.isPinned },
      newValues: { noteId, isPinned: updated.isPinned },
    });

    return updated;
  }

  async deleteNote(personaId: number, noteId: number, userId: number) {
    const existing = await prisma.personaNote.findFirst({
      where: { id: noteId, personaId },
    });
    if (!existing) throw new Error('Nota no encontrada.');

    await prisma.personaNote.delete({ where: { id: noteId } });

    await logAudit({
      userId,
      action: 'DELETE_PERSONA_NOTE',
      entityType: 'Persona',
      entityId: personaId,
      oldValues: { noteId, category: existing.category, content: existing.content },
    });

    return { deletedId: noteId };
  }

  async updateTrustTags(personaId: number, trustTags: string[], userId: number) {
    const existing = await this.ensurePersonaExists(personaId);
    const uniqueTags = Array.from(new Set(trustTags));

    const updated = await prisma.persona.update({
      where: { id: personaId },
      data: { trustTags: uniqueTags },
      select: { id: true, trustTags: true },
    });

    await logAudit({
      userId,
      action: 'UPDATE_PERSONA_TRUST_TAGS',
      entityType: 'Persona',
      entityId: personaId,
      oldValues: { trustTags: existing.trustTags },
      newValues: { trustTags: updated.trustTags },
    });

    return updated;
  }
}

export const personaNotesSubService = new PersonaNotesSubService();
