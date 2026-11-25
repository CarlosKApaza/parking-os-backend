import { Body, Controller, Get, Header, Headers, Post, ServiceUnavailableException } from '@nestjs/common';
import { origenLectura } from '../sensores/sensores.controller.js';
import { CamarasService } from './camaras.service.js';
import { GaritasService, modoGaritas } from './garitas.service.js';

@Controller('garitas')
export class GaritasController {
  constructor(private readonly garitas: GaritasService,private readonly camaras:CamarasService) {}

  @Get('terminal-salida')
  @Header('Cache-Control','no-store')
  terminal(@Headers('x-camera-key') clave:string|undefined){
    this.camaras.autorizar(clave);
    return this.garitas.terminalSalida();
  }

  @Post('sincronizar')
  @Header('Content-Type', 'text/plain; charset=utf-8')
  sincronizar(@Headers('x-esp32-key') clave: string | undefined, @Body() body: unknown) {
    origenLectura(clave, process.env.ESP32_API_KEY, false);
    if (!modoGaritas()) throw new ServiceUnavailableException('Garitas autorizadas desactivadas');
    return this.garitas.sincronizar(body);
  }
}
