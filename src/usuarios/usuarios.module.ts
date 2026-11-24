import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { UsuariosController } from './usuarios.controller.js';
import { UsuariosService } from './usuarios.service.js';
@Module({ imports:[AuthModule, PrismaModule], controllers:[UsuariosController], providers:[UsuariosService] })
export class UsuariosModule {}
