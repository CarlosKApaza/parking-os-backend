
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ESTADOS_ACTIVOS } from '../reservas/reglas.js';
import { calcularDisponibilidad } from './disponibilidad.js';

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

  // Consolidar ocupacion fisica, reservas y retenciones sin modificar sus estados.
  async obtenerDisponibilidad() {
    const ahora = new Date();
    const plazas = await this.prisma.estacionamiento.findMany({
      orderBy: { id: 'asc' },
      select: {
        id: true, codigo: true, sensorCodigo: true,
        activo: true, estado: true, ultimaLectura: true,
        reservas: {
          where: { estado: { in: [...ESTADOS_ACTIVOS] }, fechaFin: { gt: ahora } },
          orderBy: { fechaInicio: 'asc' },
          select: { estado: true, fechaInicio: true, fechaFin: true },
        },
        retencion: { select: { venceEn: true } },
      },
    });
    const permitirLecturaAntigua =
      process.env.RESERVAS_PERMITIR_LECTURA_ANTIGUA === '1' &&
      process.env.NODE_ENV !== 'production';
    return {
      servidorAhora: ahora,
      plazas: plazas.map(p => calcularDisponibilidad(p, ahora, permitirLecturaAntigua)),
    };
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
