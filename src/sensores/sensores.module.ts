
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { SensoresController } from './sensores.controller.js';
import { SensoresService } from './sensores.service.js';
import { TiempoRealModule } from '../tiempo-real/tiempo-real.module.js';

@Module({
  imports: [PrismaModule, TiempoRealModule],
  controllers: [SensoresController],
  providers: [SensoresService],
})
export class SensoresModule {}
