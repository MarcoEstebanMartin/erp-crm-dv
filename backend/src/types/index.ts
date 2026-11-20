import { Request } from 'express';
import { Role } from '@prisma/client';

export interface UserPayload {
  id: number;
  username: string;
  role: Role;
  pwdVer?: string;
  scope?: 'staff';
}

export interface AuthenticatedRequest extends Request {
  user?: UserPayload;
}
