import { Module } from '@nestjs/common';
import { createObserveModule } from '@nestjs/observe';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { EstacionamientosModule } from './estacionamientos/estacionamientos.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { SensoresModule } from './sensores/sensores.module.js';
import { CamarasModule } from './camaras/camaras.module.js';

import { AuthModule } from './auth/auth.module.js';
import { UsuariosModule } from './usuarios/usuarios.module.js';
import { ReservasModule } from './reservas/reservas.module.js';
import { VehiculosModule } from './vehiculos/vehiculos.module.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    // Distributed tracing, auto-correlated logs, request/job metrics, error
    // telemetry, alarms, and more — out of the box. Sign up at https://observe.nestjs.com
    ObserveModule.forRoot({
      appKey: 'YOUR_APP_KEY',
      appSecret: 'YOUR_APP_SECRET',
      serviceId: 'servidor_backend',
    }),
    EstacionamientosModule,
    PrismaModule,
    SensoresModule,
    CamarasModule,
    AuthModule,
    UsuariosModule,
    VehiculosModule,
    ReservasModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
