
import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class SensoresService {
  constructor(private readonly prisma: PrismaService) {}

  // Procesar una lectura simulada del sensor
  async registrarLectura(sensorCodigo: string, ocupado: boolean) {

    // 1. Validar los datos recibidos
    if (
      typeof sensorCodigo !== 'string' ||
      !sensorCodigo.trim() ||
      typeof ocupado !== 'boolean'
    ) {
      throw new BadRequestException('Lectura del sensor no valida');
    }

    const codigo = sensorCodigo.trim().toUpperCase();
    const estadoNuevo = ocupado ? 'OCUPADO' : 'LIBRE';
    const fechaLectura = new Date();

    // 2. Ejecutar operaciones en una transaccion
    return this.prisma.$transaction(async (tx) => {

      // Buscar el estacionamiento por codigo de sensor
      const estacionamiento = await tx.estacionamiento.findUnique({
        where: {
          sensorCodigo: codigo,
        },
      });

      if (!estacionamiento) {
        throw new NotFoundException('Sensor no registrado');
      }

      // 3. Comprobar si cambio el estado
      const huboCambio = estacionamiento.estado !== estadoNuevo;

      // 4. Actualizar estacionamiento y ultima lectura
      const actualizado = await tx.estacionamiento.update({
        where: {
          id: estacionamiento.id,
        },
        data: {
          estado: estadoNuevo,
          ultimaLectura: fechaLectura,
        },
      });

      // 5. Registrar evento solamente si cambio el estado
      if (huboCambio) {
        await tx.eventoEstacionamiento.create({
          data: {
            estacionamientoId: estacionamiento.id,
            estadoAnterior: estacionamiento.estado,
            estadoNuevo: estadoNuevo,
            origen: 'SIMULACION',
            fechaEvento: fechaLectura,
          },
        });
      }

      // 6. Devolver resultado
      return {
        mensaje: 'Lectura procesada correctamente',
        estacionamiento: actualizado.codigo,
        sensor: codigo,
        estado: actualizado.estado,
        cambioRegistrado: huboCambio,
      };
    });
  }
}
