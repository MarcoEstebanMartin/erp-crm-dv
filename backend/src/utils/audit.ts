import prisma from './prisma';

interface AuditLogParams {
  userId: number;
  action: string;
  entityType: string;
  entityId: number;
  oldValues?: any;
  newValues?: any;
  ipAddress?: string | null;
}

/**
 * Registra una acción en el log de auditoría inmutable.
 */
export async function logAudit({
  userId,
  action,
  entityType,
  entityId,
  oldValues = null,
  newValues = null,
  ipAddress = null,
}: AuditLogParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entityType,
        entityId,
        oldValues: oldValues ? JSON.parse(JSON.stringify(oldValues)) : null,
        newValues: newValues ? JSON.parse(JSON.stringify(newValues)) : null,
        ipAddress,
      },
    });
    console.log(`[AUDIT LOG] ${action} registrado por usuario ${userId} para la entidad ${entityType} ID ${entityId}`);
  } catch (error) {
    console.error('❌ Error registrando log de auditoría:', error);
    // En sistemas ultra críticos, se podría arrojar el error. 
    // Aquí registramos la falla en consola para evitar bloquear el flujo principal.
  }
}
