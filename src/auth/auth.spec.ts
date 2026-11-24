import { afterEach, describe, expect, it, vi } from 'vitest';
import { hashPassword, verifyPassword } from './password.js';
import { JwtService } from './jwt.service.js';
import { AuthService } from './auth.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';

describe('auth', () => {
  afterEach(() => vi.unstubAllEnvs());
  it('hash con sal aleatoria y verificación', async () => {
    const a = await hashPassword('Parking123*');
    const b = await hashPassword('Parking123*');
    expect(a).not.toBe(b);
    expect(await verifyPassword('Parking123*',a)).toBe(true);
    expect(await verifyPassword('incorrecta',a)).toBe(false);
  });
  it('firma y verifica la identidad, rechaza firma modificada', async () => {
    vi.stubEnv('JWT_SECRET','clave-de-prueba-de-32-bytes-o-mas-123');
    const jwt = new JwtService();
    const token = await jwt.sign(7);
    expect(await jwt.verify(token)).toBe(7);
    const parts = token.split('.');
    parts[2] = (parts[2][0]==='A'?'B':'A')+parts[2].slice(1);
    await expect(jwt.verify(parts.join('.'))).rejects.toThrow();
  });
  it('registro no permite elegir rol o saldo inicial', async () => {
    const create = vi.fn().mockResolvedValue({id:1,nombre:'Demo'});
    const service = new AuthService({usuario:{create}} as unknown as PrismaService,new JwtService());
    await service.registro({nombre:'Demo',correo:'DEMO@parkingos.test',password:'Parking123*',rol:'ADMINISTRADOR',saldo:10000});
    expect(create.mock.calls[0][0].data).toMatchObject({rol:'CLIENTE',correo:'demo@parkingos.test',billetera:{create:{saldo:0}}});
    expect(create.mock.calls[0][0].data.passwordHash).not.toBe('Parking123*');
  });
  it('login no devuelve el hash ni autentica una contraseña errónea', async () => {
    vi.stubEnv('JWT_SECRET','clave-de-prueba-de-32-bytes-o-mas-123');
    const findUnique=vi.fn().mockResolvedValue({id:1,activo:true,passwordHash:await hashPassword('Parking123*')});
    const service=new AuthService({usuario:{findUnique}} as unknown as PrismaService,new JwtService());
    const result=await service.login({correo:'demo@parkingos.test',password:'Parking123*'});
    expect(result.usuario).not.toHaveProperty('passwordHash');
    expect(result.accessToken).toBeTruthy();
    await expect(service.login({correo:'demo@parkingos.test',password:'incorrecta'})).rejects.toThrow();
  });
});
