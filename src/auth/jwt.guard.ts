import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service.js';
import { JwtService } from './jwt.service.js';

export type AuthRequest = Request & { usuario: Awaited<ReturnType<AuthService['me']>> };

@Injectable()
export class JwtGuard implements CanActivate {
  constructor(private readonly jwt: JwtService, private readonly auth: AuthService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const match = /^Bearer ([^\s]+)$/i.exec(request.headers.authorization ?? '');
    if (!match) throw new UnauthorizedException('Se requiere un token Bearer.');
    request.usuario = await this.auth.me(await this.jwt.verify(match[1]));
    return true;
  }
}
