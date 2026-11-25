import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { CamarasController } from './camaras.controller.js';
import { GaritasController } from './garitas.controller.js';
import { GaritasService } from './garitas.service.js';
import { TiempoRealModule } from '../tiempo-real/tiempo-real.module.js';
import { CamarasService } from './camaras.service.js';

@Module({
  imports: [PrismaModule, TiempoRealModule],
  controllers: [CamarasController, GaritasController],
  providers: [CamarasService, GaritasService],
})
export class CamarasModule {}
