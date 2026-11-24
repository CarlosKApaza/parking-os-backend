import { Module } from '@nestjs/common';
import { EstacionamientosGateway } from './estacionamientos.gateway.js';

@Module({
  providers: [EstacionamientosGateway],
  exports: [EstacionamientosGateway],
})
export class TiempoRealModule {}
