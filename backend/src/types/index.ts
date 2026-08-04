import { Request } from 'express';
import { Role } from '@prisma/client';

export interface UserPermissions {
  canSell: boolean;
  canPick: boolean;
  canDeliver: boolean;
  canCollect: boolean;
  canManageStock: boolean;
}

export interface UserPayload {
  id: number;
  username: string;
  role: Role;
  permissions?: UserPermissions;
}

export interface AuthenticatedRequest extends Request {
  user?: UserPayload;
}
