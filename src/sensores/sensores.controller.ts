
import { Controller, Post, Body } from '@nestjs/common';
import { SensoresService } from './sensores.service.js';

@Controller('sensores')
export class SensoresController {
  constructor(
    private readonly sensoresService: SensoresService,
  ) {}

  // Recibir una lectura simulada de un sensor
  @Post('lecturas')
  async registrarLectura(
    @Body() datos: { sensorCodigo: string; ocupado: boolean },
  ) {
    return this.sensoresService.registrarLectura(
      datos.sensorCodigo,
      datos.ocupado,
    );
  }
}
