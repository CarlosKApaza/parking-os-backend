import 'dotenv/config';
import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { SignJWT, jwtVerify } from 'jose';

const ISSUER = 'parking-os';
const AUDIENCE = 'parking-os-clientes';
export const TOKEN_TTL_SECONDS = 3600;

@Injectable()
export class JwtService {
  private key(): Uint8Array {
    const secret = process.env.JWT_SECRET ?? '';
    if (Buffer.byteLength(secret, 'utf8') < 32) throw new ServiceUnavailableException('Configura JWT_SECRET (mínimo 32 bytes) en NestJS.');
    return new TextEncoder().encode(secret);
  }

  async sign(userId: number): Promise<string> {
    return new SignJWT({}).setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(String(userId)).setIssuer(ISSUER).setAudience(AUDIENCE)
      .setIssuedAt().setExpirationTime(Math.floor(Date.now()/1000) + TOKEN_TTL_SECONDS).sign(this.key());
  }

  async verify(token: string): Promise<number> {
    const key = this.key();
    try {
      const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'], issuer: ISSUER, audience: AUDIENCE, requiredClaims: ['sub', 'iat', 'exp'] });
      const id = Number(payload.sub);
      if (!Number.isSafeInteger(id) || id < 1 || String(id) !== payload.sub) throw new Error('sub inválido');
      return id;
    } catch {
      throw new UnauthorizedException('Sesión inválida o vencida.');
    }
  }
}
