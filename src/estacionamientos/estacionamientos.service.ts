
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class EstacionamientosService {
  constructor(private readonly prisma: PrismaService) {}

  // Listar todos los estacionamientos
  async listarTodos() {
    return this.prisma.estacionamiento.findMany({
      orderBy: {
        id: 'asc',
      },
    });
  }

  // Obtener resumen de disponibilidad
  async obtenerResumen() {
    const total = await this.prisma.estacionamiento.count();

    const libres = await this.prisma.estacionamiento.count({
      where: {
        estado: 'LIBRE',
        activo: true,
      },
    });

    const ocupados = await this.prisma.estacionamiento.count({
      where: {
        estado: 'OCUPADO',
      },
    });

    const desconocidos = await this.prisma.estacionamiento.count({
      where: {
        estado: 'DESCONOCIDO',
      },
    });

    const deshabilitados = await this.prisma.estacionamiento.count({
      where: {
        activo: false,
      },
    });

    return {
      total,
      libres,
      ocupados,
      desconocidos,
      deshabilitados,
    };
  }
}
