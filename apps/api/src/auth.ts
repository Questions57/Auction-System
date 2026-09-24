import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Request } from 'express';

export type CurrentUser = { id: string; role: Role };
export type AuthenticatedRequest = Request & { user: CurrentUser };

@Injectable()
export class HeaderAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const id = request.header('x-user-id');
    const role = request.header('x-user-role');

    if (!id || (role !== Role.ADMIN && role !== Role.BIDDER)) {
      throw new UnauthorizedException('Provide x-user-id and x-user-role headers.');
    }

    request.user = { id, role };
    return true;
  }
}

export function requireAdmin(user: CurrentUser) {
  if (user.role !== Role.ADMIN) {
    throw new ForbiddenException('Administrator access is required.');
  }
}

