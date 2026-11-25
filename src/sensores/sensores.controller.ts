import { BadRequestException, Body, Controller, Headers, Post, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { SensoresService } from './sensores.service.js';

export function origenLectura(clave: string | undefined, configurada: string | undefined, permitirSimulacion: boolean): 'SENSOR_IR' | 'SIMULACION' {
  if (clave !== undefined) {
    const recibida = Buffer.from(clave);
    const esperada = Buffer.from(configurada ?? '');
    if (esperada.length < 32 || recibida.length !== esperada.length || !timingSafeEqual(recibida, esperada)) {
      throw new UnauthorizedException('Clave ESP32 invalida');
    }
    return 'SENSOR_IR';
  }
  if (!permitirSimulacion) throw new UnauthorizedException('Se requiere x-esp32-key');
  return 'SIMULACION';
}

@Controller('sensores')
export class SensoresController {
  constructor(private readonly sensoresService: SensoresService) {}

  @Post('lecturas')
  async registrarLectura(
    @Headers('x-esp32-key') clave: string | undefined,
    @Body() datos: { sensorCodigo: string; ocupado: boolean },
  ) {
    const origen = origenLectura(clave, process.env.ESP32_API_KEY,
      process.env.SENSORES_PERMITIR_SIMULACION === '1' && process.env.NODE_ENV !== 'production');
    if (!datos || typeof datos !== 'object') throw new BadRequestException('Lectura del sensor no valida');
    return this.sensoresService.registrarLectura(datos.sensorCodigo, datos.ocupado, origen);
  }
}
