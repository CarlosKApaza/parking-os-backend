
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

  // Disponibilidad consolidada; no expone datos privados de usuarios.
  @Get('disponibilidad')
  async obtenerDisponibilidad() {
    return this.estacionamientosService.obtenerDisponibilidad();
  }

  // Obtener resumen de disponibilidad
  @Get('resumen')
  async obtenerResumen() {
    return this.estacionamientosService.obtenerResumen();
  }
}
