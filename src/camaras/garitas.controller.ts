import { Body, Controller, Header, Headers, Post, ServiceUnavailableException } from '@nestjs/common';
import { origenLectura } from '../sensores/sensores.controller.js';
import { GaritasService, modoGaritas } from './garitas.service.js';

@Controller('garitas')
export class GaritasController {
  constructor(private readonly garitas: GaritasService) {}

  @Post('sincronizar')
  @Header('Content-Type', 'text/plain; charset=utf-8')
  sincronizar(@Headers('x-esp32-key') clave: string | undefined, @Body() body: unknown) {
    origenLectura(clave, process.env.ESP32_API_KEY, false);
    if (!modoGaritas()) throw new ServiceUnavailableException('Garitas autorizadas desactivadas');
    return this.garitas.sincronizar(body);
  }
}
