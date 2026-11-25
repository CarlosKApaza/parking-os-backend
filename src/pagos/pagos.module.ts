import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { CamarasModule } from '../camaras/camaras.module.js';
import { PagosController } from './pagos.controller.js';
import { PagosService } from './pagos.service.js';
@Module({imports:[PrismaModule,AuthModule,CamarasModule],controllers:[PagosController],providers:[PagosService]})
export class PagosModule {}
