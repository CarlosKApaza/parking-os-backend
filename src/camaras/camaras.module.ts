import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { CamarasController } from './camaras.controller.js';
import { CamarasService } from './camaras.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [CamarasController],
  providers: [CamarasService],
})
export class CamarasModule {}
