import {
  BadRequestException,
  ConflictException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';

type Zona = 'ENTRADA' | 'SALIDA';

@Injectable()
export class CamarasService {
  constructor(private readonly prisma: PrismaService) {}

  autorizar(clave: string | undefined): void {
    const esperada = process.env.CAMERA_API_KEY;
    if (!esperada || esperada.length < 16) {
      throw new ServiceUnavailableException('Configura CAMERA_API_KEY (minimo 16 caracteres) en el backend.');
    }
    const a = Buffer.from(clave ?? '', 'utf8');
    const b = Buffer.from(esperada, 'utf8');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Clave de camara incorrecta.');
    }
  }

  async registrarLectura(cuerpo: unknown) {
    if (!cuerpo || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) {
      throw new BadRequestException('Se requiere un objeto JSON.');
    }
    const datos = cuerpo as Record<string, unknown>;
    const placa = typeof datos.placa === 'string' ? datos.placa.trim().toUpperCase() : '';
    const zona = datos.zona as Zona;
    const confirmaciones = datos.confirmaciones;
    const camara = typeof datos.camaraId === 'string' ? datos.camaraId.trim().toUpperCase() : zona === 'SALIDA' ? 'CAM-SALIDA' : 'CAM-ENTRADA';

    // Formato de las placas impresas de prueba: 4 numeros + 3 letras.
    if (!/^\d{4}[A-Z]{3}$/.test(placa)) {
      throw new BadRequestException('La placa debe tener el formato 1234ABC.');
    }
    if (zona !== 'ENTRADA' && zona !== 'SALIDA') {
      throw new BadRequestException('La zona debe ser ENTRADA o SALIDA.');
    }
    if (typeof confirmaciones !== 'number' || !Number.isInteger(confirmaciones) || confirmaciones < 3 || confirmaciones > 100) {
      throw new BadRequestException('El OCR debe confirmar al menos 3 lecturas iguales.');
    }
    if (!/^[A-Z0-9_-]{1,32}$/.test(camara)) {
      throw new BadRequestException('Identificador de camara no valido.');
    }

    const activa = await this.prisma.visitaVehiculo.findUnique({ where: { placaActiva: placa } });
    if (zona === 'ENTRADA') {
      if (activa) {
        return { registrado: false, motivo: 'Vehiculo ya dentro del estacionamiento', visita: activa };
      }
      try {
        const visita = await this.prisma.visitaVehiculo.create({
          data: { placa, placaActiva: placa, camaraIngreso: camara },
        });
        return { registrado: true, evento: 'INGRESO', visita };
      } catch (error) {
        // La clave UNIQUE protege contra dos procesos OCR que leen al mismo tiempo.
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          const existente = await this.prisma.visitaVehiculo.findUnique({ where: { placaActiva: placa } });
          if (existente) return { registrado: false, motivo: 'Ingreso ya registrado', visita: existente };
        }
        throw error;
      }
    }

    if (!activa) {
      // Cuando el vehiculo aun esta frente a la camara, evitar una salida duplicada.
      const reciente = await this.prisma.visitaVehiculo.findFirst({
        where: { placa, fechaSalida: { not: null } },
        orderBy: { fechaSalida: 'desc' },
      });
      if (reciente?.fechaSalida && Date.now() - reciente.fechaSalida.getTime() < 30000) {
        return { registrado: false, motivo: 'Salida ya registrada', visita: reciente };
      }
      throw new ConflictException('Esta matricula no tiene un ingreso abierto.');
    }

    const fechaSalida = new Date();
    // Actualizacion condicional: otra lectura simultanea no puede cerrar dos veces.
    const cierre = await this.prisma.visitaVehiculo.updateMany({
      where: { id: activa.id, placaActiva: placa, fechaSalida: null },
      data: { placaActiva: null, fechaSalida, camaraSalida: camara },
    });
    const visita = await this.prisma.visitaVehiculo.findUniqueOrThrow({ where: { id: activa.id } });
    const duracionMinutos = Math.max(0, Math.ceil(((visita.fechaSalida ?? fechaSalida).getTime() - visita.fechaIngreso.getTime()) / 60000));
    return {
      registrado: cierre.count === 1,
      evento: 'SALIDA',
      visita,
      duracionMinutos,
      // El cobro real y el QR NO se generan en esta fase.
      cobro: 'PENDIENTE_DE_IMPLEMENTAR',
    };
  }

  listarVisitas() {
    return this.prisma.visitaVehiculo.findMany({
      take: 30,
      orderBy: { fechaIngreso: 'desc' },
    });
  }

  listarActivos() {
    return this.prisma.visitaVehiculo.findMany({
      where: { placaActiva: { not: null } },
      orderBy: { fechaIngreso: 'desc' },
    });
  }
}
