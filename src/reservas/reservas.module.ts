import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { TiempoRealModule } from '../tiempo-real/tiempo-real.module.js';
import { ReservasController } from './reservas.controller.js';
import { ReservasService } from './reservas.service.js';
@Module({imports:[PrismaModule,AuthModule,TiempoRealModule],controllers:[ReservasController],providers:[ReservasService]})
export class ReservasModule {}
