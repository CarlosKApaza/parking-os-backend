import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { hashPassword, verifyPassword } from './password.js';
import { email, objectBody, password, requiredText, optionalText } from './validation.js';
import { JwtService, TOKEN_TTL_SECONDS } from './jwt.service.js';

export const publicUser = { id:true, nombre:true, correo:true, telefono:true, rol:true, activo:true, fechaRegistro:true, billetera:{select:{id:true,saldo:true}} } satisfies Prisma.UsuarioSelect;
const DUMMY = 'scrypt$' + '00'.repeat(16) + '$' + '00'.repeat(64);

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) {}

  async registro(body: unknown) {
    const data = objectBody(body);
    const nombre = requiredText(data.nombre, 'Nombre', 100, 2);
    const correo = email(data.correo);
    const passwordHash = await hashPassword(password(data.password, true));
    const telefono = optionalText(data.telefono, 'Teléfono', 20);
    try {
      // La identidad, el rol y el saldo inicial los determina el servidor.
      const usuario = await this.prisma.usuario.create({
        data: { nombre, correo, passwordHash, telefono, rol: 'CLIENTE', billetera: { create: { saldo: 0 } } },
        select: publicUser,
      });
      return { usuario };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('El correo ya está registrado.');
      throw error;
    }
  }

  async login(body: unknown) {
    const data = objectBody(body);
    const correo = email(data.correo);
    const clave = password(data.password);
    const user = await this.prisma.usuario.findUnique({ where: { correo }, select: { ...publicUser, passwordHash:true } });
    const valid = await verifyPassword(clave, user?.passwordHash ?? DUMMY);
    if (!user || !user.activo || !valid) throw new UnauthorizedException('Correo o contraseña incorrectos.');
    const { passwordHash: _hash, ...usuario } = user;
    return { accessToken: await this.jwt.sign(usuario.id), tokenType: 'Bearer', expiresIn: TOKEN_TTL_SECONDS, usuario };
  }

  async me(id: number) {
    const usuario = await this.prisma.usuario.findUnique({ where:{id}, select: publicUser });
    if (!usuario?.activo) throw new UnauthorizedException('Cuenta no disponible.');
    return usuario;
  }
}
