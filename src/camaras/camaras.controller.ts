import { Body, Controller, Get, Headers, Post } from '@nestjs/common';
import { GaritasService, modoGaritas } from './garitas.service.js';
import { CamarasService } from './camaras.service.js';

@Controller('camaras')
export class CamarasController {
  constructor(private readonly camaras: CamarasService, private readonly garitas: GaritasService) {}

  // Solo el proceso OCR de la garita puede registrar entradas o salidas.
  @Post('lecturas')
  registrar(@Headers('x-camera-key') clave: string | undefined, @Body() lectura: unknown) {
    this.camaras.autorizar(clave);
    return modoGaritas() ? this.garitas.reconocer(lectura) : this.camaras.registrarLectura(lectura);
  }

  // Consultas para la demostracion tecnica; no exponer matriculas sin autorizacion.
  @Get('visitas')
  listar(@Headers('x-camera-key') clave: string | undefined) {
    this.camaras.autorizar(clave);
    return this.camaras.listarVisitas();
  }

  @Get('activos')
  activos(@Headers('x-camera-key') clave: string | undefined) {
    this.camaras.autorizar(clave);
    return this.camaras.listarActivos();
  }
}
