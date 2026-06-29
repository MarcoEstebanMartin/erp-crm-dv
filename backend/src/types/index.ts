import { Request } from 'express';
import { Role } from '@prisma/client';

export interface UserPayload {
  id: number;
  username: string;
  role: Role;
}

export interface AuthenticatedRequest extends Request {
  user?: UserPayload;
}
