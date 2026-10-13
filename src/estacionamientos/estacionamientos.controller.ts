
import { Controller, Get } from '@nestjs/common';
import { EstacionamientosService } from './estacionamientos.service.js';

@Controller('estacionamientos')
export class EstacionamientosController {
  constructor(
    private readonly estacionamientosService: EstacionamientosService,
  ) {}

  // Listar los 7 estacionamientos
  @Get()
  async listarTodos() {
    return this.estacionamientosService.listarTodos();
  }

  // Obtener resumen de disponibilidad
  @Get('resumen')
  async obtenerResumen() {
    return this.estacionamientosService.obtenerResumen();
  }
}
