import { Body, Controller, Get, HttpCode, HttpException, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service.js';
import { JwtGuard, type AuthRequest } from './jwt.guard.js';

@Controller('auth')
export class AuthController {
  // Límite local de prototipo por IP; no reemplaza un limitador distribuido.
  private readonly attempts = new Map<string, { until:number; count:number }>();
  constructor(private readonly auth: AuthService) {}

  private limit(request: Request) {
    const now = Date.now();
    for (const [key, value] of this.attempts) if (value.until <= now) this.attempts.delete(key);
    const ip = request.ip ?? request.socket.remoteAddress ?? 'unknown';
    let item = this.attempts.get(ip);
    if (!item) {
      if (this.attempts.size >= 2048) throw new HttpException('Demasiadas solicitudes. Intenta más tarde.', 429);
      item = { until:now+60000, count:0 };
      this.attempts.set(ip,item);
    }
    if (++item.count > 30) throw new HttpException('Demasiadas solicitudes. Intenta en un minuto.', 429);
  }

  @Post('registro')
  registro(@Body() body: unknown, @Req() request: Request) {
    this.limit(request);
    return this.auth.registro(body);
  }

  @Post('login')
  @HttpCode(200)
  login(@Body() body: unknown, @Req() request: Request) {
    this.limit(request);
    return this.auth.login(body);
  }

  @Get('me')
  @UseGuards(JwtGuard)
  me(@Req() request: AuthRequest) { return request.usuario; }
}
