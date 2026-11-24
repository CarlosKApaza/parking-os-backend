import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { VehiculosController } from './vehiculos.controller.js';
import { VehiculosService } from './vehiculos.service.js';
@Module({ imports:[PrismaModule, AuthModule], controllers:[VehiculosController], providers:[VehiculosService] })
export class VehiculosModule {}
