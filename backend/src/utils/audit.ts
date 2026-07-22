import prisma from './prisma';

interface AuditLogParams {
  userId: number;
  action: string;
  entityType: string;
  entityId: number;
  oldValues?: any;
  newValues?: any;
  status?: 'SUCCESS' | 'ERROR' | 'WARNING';
  errorMessage?: string | null;
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
  status = 'SUCCESS',
  errorMessage = null,
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
        status,
        errorMessage,
        ipAddress,
      },
    });
    console.log(`[AUDIT LOG] [${status}] ${action} registrado por usuario ${userId} para ${entityType} ID ${entityId}`);
  } catch (error) {
    console.error('❌ Error registrando log de auditoría:', error);
  }
}
