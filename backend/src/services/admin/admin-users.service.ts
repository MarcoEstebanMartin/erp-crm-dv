import prisma from '../../utils/prisma';
import bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';
import { logAudit } from '../../utils/audit';
import { sessionCache } from '../../utils/session-cache.util';

export class AdminUsersSubService {
  /**
   * Obtener logs de auditoría paginados.
   */
  async getAuditLogs(page: number, limit: number) {
    const skip = (page - 1) * limit;

    const [logs, total] = await prisma.$transaction([
      prisma.auditLog.findMany({
        skip,
        take: limit,
        include: {
          user: {
            select: { id: true, username: true, role: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.auditLog.count(),
    ]);

    return {
      logs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Obtener logs de auditoría para un documento o entidad específica.
   */
  async getDocumentAuditLogs(entityType: string, entityId: number) {
    return prisma.auditLog.findMany({
      where: {
        entityType,
        entityId: Number(entityId),
      },
      include: {
        user: {
          select: { id: true, username: true, role: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Obtener listado de usuarios.
   */
  async getUsers() {
    return prisma.user.findMany({
      select: {
        id: true,
        username: true,
        role: true,
        permissions: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { username: 'asc' },
    });
  }

  /**
   * Crear un nuevo usuario.
   */
  async createUser(data: any, adminId?: number) {
    const { username, password, role, permissions } = data;

    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      throw new Error('El nombre de usuario ya está registrado.');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = await prisma.user.create({
      data: {
        username,
        passwordHash,
        role: role as Role,
        permissions: permissions || null,
      },
      select: {
        id: true,
        username: true,
        role: true,
        permissions: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (adminId) {
      await logAudit({
        userId: adminId,
        action: 'CREATE_USER',
        entityType: 'User',
        entityId: newUser.id,
        newValues: {
          username: newUser.username,
          role: newUser.role,
          permissions: newUser.permissions,
        },
      });
    }

    return newUser;
  }

  /**
   * Habilitar/Deshabilitar usuario.
   */
  async toggleUserStatus(id: number, adminId?: number) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new Error('Usuario no encontrado.');

    if (user.id === adminId) {
      throw new Error('No podés desactivar tu propio usuario administrador.');
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { isActive: !user.isActive },
      select: { id: true, username: true, isActive: true },
    });
    sessionCache.invalidateStaffSession(user.id);

    if (adminId) {
      await logAudit({
        userId: adminId,
        action: 'TOGGLE_USER_STATUS',
        entityType: 'User',
        entityId: user.id,
        oldValues: { isActive: user.isActive },
        newValues: { isActive: updated.isActive },
      });
    }

    return updated;
  }

  /**
   * Actualizar nombre de usuario, rol, permisos y/o contraseña.
   */
  async updateUser(
    id: number,
    data: { username?: string; role?: Role; password?: string; permissions?: any },
    adminId?: number,
  ) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new Error('Usuario no encontrado.');

    const updateData: any = {};
    if (data.username && data.username.trim() !== '' && data.username.trim() !== user.username) {
      const existing = await prisma.user.findUnique({ where: { username: data.username.trim() } });
      if (existing) {
        throw new Error('El nombre de usuario ya está registrado.');
      }
      updateData.username = data.username.trim();
    }
    if (data.role) {
      updateData.role = data.role;
    }
    if (data.permissions !== undefined) {
      updateData.permissions = data.permissions;
    }
    if (data.password && data.password.trim().length >= 4) {
      const salt = await bcrypt.genSalt(10);
      updateData.passwordHash = await bcrypt.hash(data.password, salt);
    }

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        username: true,
        role: true,
        permissions: true,
        isActive: true,
        createdAt: true,
      },
    });
    sessionCache.invalidateStaffSession(id);

    if (adminId) {
      await logAudit({
        userId: adminId,
        action: 'UPDATE_USER',
        entityType: 'User',
        entityId: user.id,
        oldValues: { role: user.role },
        newValues: { role: updated.role, passwordChanged: !!data.password },
      });
    }

    return updated;
  }

  /**
   * Eliminar usuario por username o ID.
   */
  async deleteUser(usernameOrId: string | number, adminId?: number) {
    const user =
      typeof usernameOrId === 'number' || !isNaN(Number(usernameOrId))
        ? await prisma.user.findUnique({ where: { id: Number(usernameOrId) } })
        : await prisma.user.findUnique({ where: { username: String(usernameOrId) } });

    if (!user) throw new Error('Usuario no encontrado.');

    if (user.id === adminId) {
      throw new Error('No podés eliminar tu propio usuario administrador en sesión.');
    }

    await prisma.user.delete({ where: { id: user.id } });
    sessionCache.invalidateStaffSession(user.id);

    if (adminId) {
      await logAudit({
        userId: adminId,
        action: 'DELETE_USER',
        entityType: 'User',
        entityId: user.id,
        oldValues: { username: user.username, role: user.role },
      });
    }

    return { success: true, username: user.username };
  }
}

export const adminUsersSubService = new AdminUsersSubService();
