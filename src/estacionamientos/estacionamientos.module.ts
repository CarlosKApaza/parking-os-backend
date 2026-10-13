
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { EstacionamientosController } from './estacionamientos.controller.js';
import { EstacionamientosService } from './estacionamientos.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [EstacionamientosController],
  providers: [EstacionamientosService],
})
export class EstacionamientosModule {}
