import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { publicUser } from '../auth/auth.service.js';
import { objectBody, requiredText, optionalText } from '../auth/validation.js';

@Injectable()
export class UsuariosService {
  constructor(private readonly prisma: PrismaService) {}
  editar(id: number, body: unknown) {
    const data = objectBody(body);
    const update: { nombre?:string; telefono?:string|null } = {};
    if ('nombre' in data) update.nombre = requiredText(data.nombre, 'Nombre', 100, 2);
    if ('telefono' in data) update.telefono = optionalText(data.telefono, 'Teléfono', 20);
    if (!Object.keys(update).length) throw new BadRequestException('No hay campos de perfil para actualizar.');
    return this.prisma.usuario.update({ where:{id}, data:update, select:publicUser });
  }
}
