
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { SensoresController } from './sensores.controller.js';
import { SensoresService } from './sensores.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [SensoresController],
  providers: [SensoresService],
})
export class SensoresModule {}
