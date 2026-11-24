import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { objectBody, requiredText, optionalText } from '../auth/validation.js';
import { verificacionDemo } from './verificacion-demo.js';

@Injectable()
export class VehiculosService {
  constructor(private readonly prisma: PrismaService) {}
  listar(usuarioId: number) {
    return this.prisma.vehiculo.findMany({ where:{usuarioId, activo:true}, orderBy:{id:'desc'} });
  }
  async registrar(usuarioId: number, body: unknown) {
    const data = objectBody(body);
    const placa = requiredText(data.placa,'Placa',12).toUpperCase().replace(/[\s-]/g,'');
    if (!/^\d{4}[A-Z]{3}$/.test(placa)) throw new BadRequestException('Formato de placa de maqueta: 8520PHD.');
    const estadoVerificacion = verificacionDemo() ? 'VERIFICADO' as const : 'PENDIENTE' as const;
    const campos = { marca:optionalText(data.marca,'Marca',50), modelo:optionalText(data.modelo,'Modelo',50), color:optionalText(data.color,'Color',30) };
    try {
      return await this.prisma.$transaction(async tx => {
        const existing = await tx.vehiculo.findUnique({where:{placa}});
        if (existing) {
          if (existing.usuarioId !== usuarioId || existing.activo) throw new ConflictException('La placa no está disponible para registro.');
          return tx.vehiculo.update({where:{id:existing.id},data:{...campos,activo:true,estadoVerificacion}});
        }
        return tx.vehiculo.create({data:{usuarioId,placa,...campos,estadoVerificacion}});
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('La placa no está disponible para registro.');
      throw error;
    }
  }
  async habilitarDemo(usuarioId:number,id:number) {
    if (!verificacionDemo()) throw new ForbiddenException('La habilitación automática solo está disponible en modo feria.');
    return this.prisma.$transaction(async tx => {
      const rows = await tx.$queryRaw<{id:number}[]>`SELECT id FROM vehiculos WHERE id = ${id} AND usuarioId = ${usuarioId} AND activo = 1 FOR UPDATE`;
      if (!rows.length) throw new NotFoundException('Vehículo no encontrado.');
      const vehiculo = await tx.vehiculo.findUniqueOrThrow({where:{id}});
      if (vehiculo.estadoVerificacion === 'VERIFICADO') return vehiculo;
      if (vehiculo.estadoVerificacion !== 'PENDIENTE') throw new ConflictException('La matrícula requiere revisión.');
      return tx.vehiculo.update({where:{id},data:{estadoVerificacion:'VERIFICADO'}});
    });
  }
  async desvincular(usuarioId:number,id:number) {
    return this.prisma.$transaction(async tx => {
      const rows = await tx.$queryRaw<{id:number}[]>`SELECT id FROM vehiculos WHERE id = ${id} AND usuarioId = ${usuarioId} AND activo = 1 FOR UPDATE`;
      if (!rows.length) throw new NotFoundException('Vehículo no encontrado.');
      const [reservas, visitas] = await Promise.all([
        tx.reserva.count({where:{vehiculoId:id,estado:{in:['PENDIENTE','CONFIRMADA','EN_USO']}}}),
        tx.visitaVehiculo.count({where:{vehiculoId:id,placaActiva:{not:null}}}),
      ]);
      if (reservas || visitas) throw new ConflictException('El vehículo tiene reservas o visitas activas.');
      await tx.vehiculo.update({where:{id},data:{activo:false}});
      return { mensaje:'Vehículo desvinculado del perfil. Se conserva su historial.' };
    });
  }
}
