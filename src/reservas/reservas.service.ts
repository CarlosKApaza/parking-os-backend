import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { EstacionamientosGateway } from '../tiempo-real/estacionamientos.gateway.js';
import { objectBody, requiredText } from '../auth/validation.js';
import { disponible, horario, HOLD_MS, ESTADOS_ACTIVOS } from './reglas.js';
const active=[...ESTADOS_ACTIVOS];
const include={estacionamiento:{select:{codigo:true}},vehiculo:{select:{placa:true}}} satisfies Prisma.ReservaInclude;

@Injectable()
export class ReservasService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private sweeping=false;
  private readonly logger=new Logger(ReservasService.name);
  constructor(private readonly prisma:PrismaService,private readonly gateway:EstacionamientosGateway){}
  onModuleInit(){this.timer=setInterval(()=>void this.sweep(),1000);this.timer.unref()}
  onModuleDestroy(){if(this.timer)clearInterval(this.timer)}
  private async sweep(){
    if(this.sweeping)return;this.sweeping=true;
    try{
      const now=new Date();
      const [holds,expired]=await this.prisma.$transaction([
        this.prisma.retencionPlaza.deleteMany({where:{venceEn:{lte:now}}}),
        this.prisma.reserva.updateMany({where:{estado:{in:['PENDIENTE','CONFIRMADA']},fechaFin:{lte:now}},data:{estado:'VENCIDA'}})
      ]);
      if(holds.count||expired.count)this.gateway.publicarReservas();
    }catch(e){this.logger.warn('Limpieza de reservas: '+String(e))}finally{this.sweeping=false}
  }
  private async lock(tx:Prisma.TransactionClient,codigo:string){
    const rows=await tx.$queryRaw<{id:number}[]>`SELECT id FROM estacionamientos WHERE codigo = ${codigo} FOR UPDATE`;
    if(!rows.length)throw new NotFoundException('Plaza no encontrada.');
    return tx.estacionamiento.findUniqueOrThrow({where:{id:rows[0].id}});
  }
  private check(p:{activo:boolean;estado:string;ultimaLectura:Date|null},now:Date){
    disponible(p,now,process.env.RESERVAS_PERMITIR_LECTURA_ANTIGUA==='1'&&process.env.NODE_ENV!=='production');
  }
  private tx<T>(work:(tx:Prisma.TransactionClient)=>Promise<T>){
    return this.prisma.$transaction(work,{isolationLevel:Prisma.TransactionIsolationLevel.ReadCommitted}).catch(e=>{
      if(e instanceof Prisma.PrismaClientKnownRequestError&&['P2034','P2002'].includes(e.code))throw new ConflictException('Conflicto concurrente. Vuelve a intentar.');
      throw e;
    });
  }
  async disponibilidad(){
    const now=new Date();
    const [holds,reservas]=await this.prisma.$transaction([
      this.prisma.retencionPlaza.findMany({where:{venceEn:{gt:now}},select:{venceEn:true,estacionamiento:{select:{codigo:true}}}}),
      this.prisma.reserva.findMany({where:{estado:{in:active},fechaFin:{gt:now}},select:{fechaInicio:true,fechaFin:true,estacionamiento:{select:{codigo:true}}}})
    ]);
    return {servidorAhora:now,retenciones:holds.map(x=>({plaza:x.estacionamiento.codigo,venceEn:x.venceEn})),reservas:reservas.map(x=>({plaza:x.estacionamiento.codigo,fechaInicio:x.fechaInicio,fechaFin:x.fechaFin}))};
  }
  listar(usuarioId:number){return this.prisma.reserva.findMany({where:{usuarioId},include,orderBy:{fechaInicio:'desc'}})}
  async retener(usuarioId:number,body:unknown){
    const data=objectBody(body),codigo=requiredText(data.plaza,'Plaza',10).toUpperCase();
    const result=await this.tx(async tx=>{
      const p=await this.lock(tx,codigo),now=new Date();this.check(p,now);
      const existing=await tx.retencionPlaza.findUnique({where:{estacionamientoId:p.id}});
      if(existing&&existing.venceEn>now)throw new ConflictException('Otro cliente está seleccionando esta plaza.');
      const token=randomUUID(),venceEn=new Date(+now+HOLD_MS);
      await tx.retencionPlaza.upsert({where:{estacionamientoId:p.id},create:{estacionamientoId:p.id,usuarioId,token,venceEn},update:{usuarioId,token,venceEn}});
      return {plaza:codigo,token,venceEn,servidorAhora:now};
    });
    this.gateway.publicarReservas();return result;
  }
  async liberar(usuarioId:number,token:string){
    const result=await this.tx(async tx=>{
      const hold=await tx.retencionPlaza.findUnique({where:{token},include:{estacionamiento:{select:{codigo:true}}}});
      if(!hold||hold.usuarioId!==usuarioId)return {count:0};
      await this.lock(tx,hold.estacionamiento.codigo);
      return tx.retencionPlaza.deleteMany({where:{usuarioId,token}});
    });
    if(result.count)this.gateway.publicarReservas();
    return {liberada:!!result.count};
  }
  async confirmar(usuarioId:number,body:unknown){
    const data=objectBody(body),token=requiredText(data.token,'Retención',64);
    if(typeof data.vehiculoId!=='number'||!Number.isSafeInteger(data.vehiculoId)||data.vehiculoId<1)throw new BadRequestException('Selecciona un vehículo.');
    const vehiculoId=data.vehiculoId;
    const {fechaInicio,fechaFin}=horario(data.fechaInicio,data.fechaFin);
    const result=await this.tx(async tx=>{
      const candidate=await tx.retencionPlaza.findUnique({where:{token},include:{estacionamiento:{select:{codigo:true}}}});
      if(!candidate||candidate.usuarioId!==usuarioId)throw new ConflictException('Retención inexistente o vencida.');
      // Mismo orden de bloqueo que las futuras operaciones que vinculan vehículo y plaza.
      const vehicles=await tx.$queryRaw<{id:number}[]>`SELECT id FROM vehiculos WHERE id = ${vehiculoId} AND usuarioId = ${usuarioId} AND activo = 1 AND estadoVerificacion = 'VERIFICADO' FOR UPDATE`;
      if(!vehicles.length)throw new BadRequestException('Selecciona un vehículo verificado de tu cuenta.');
      const p=await this.lock(tx,candidate.estacionamiento.codigo),now=new Date();this.check(p,now);
      const hold=await tx.retencionPlaza.findUnique({where:{estacionamientoId:p.id}});
      if(!hold||hold.usuarioId!==usuarioId||hold.token!==token||hold.venceEn<=now)throw new ConflictException('La selección venció. Vuelve a elegir la plaza.');
      horario(data.fechaInicio,data.fechaFin,now);
      const conflict=await tx.reserva.findFirst({where:{estado:{in:active},fechaInicio:{lt:fechaFin},fechaFin:{gt:fechaInicio},OR:[{estacionamientoId:p.id},{vehiculoId}]}});
      if(conflict)throw new ConflictException('La plaza o el vehículo ya tienen una reserva en ese horario.');
      const reserva=await tx.reserva.create({data:{codigo:'RS-'+randomUUID().replace(/-/g,'').slice(0,16).toUpperCase(),usuarioId,vehiculoId,estacionamientoId:p.id,fechaInicio,fechaFin,estado:'CONFIRMADA'},include});
      await tx.retencionPlaza.delete({where:{estacionamientoId:p.id}});
      return reserva;
    });
    this.gateway.publicarReservas();return result;
  }
  async cancelar(usuarioId:number,codigo:string){
    const result=await this.tx(async tx=>{
      const r=await tx.reserva.findFirst({where:{codigo,usuarioId},include:{estacionamiento:{select:{codigo:true}}}});
      if(!r)throw new NotFoundException('Reserva no encontrada.');
      await this.lock(tx,r.estacionamiento.codigo);
      const changed=await tx.reserva.updateMany({where:{id:r.id,usuarioId,estado:{in:['PENDIENTE','CONFIRMADA']},fechaFin:{gt:new Date()}},data:{estado:'CANCELADA'}});
      if(!changed.count)throw new ConflictException('La reserva ya no se puede cancelar.');
      return tx.reserva.findUniqueOrThrow({where:{id:r.id},include});
    });
    this.gateway.publicarReservas();return result;
  }
}
