import { BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';

const ref = () => randomBytes(24).toString('hex');
const hash = (s:string) => createHash('sha256').update(s).digest('hex');
const d = (v: Prisma.Decimal | number | string) => new Prisma.Decimal(v);
export function calcularCobro(inicio:Date, ahora:Date, precio:Prisma.Decimal, modalidad:string) {
  const minutos=Math.max(1, Math.ceil((+ahora-+inicio)/60000));
  const total=precio.mul(modalidad==='POR_HORA'?Math.ceil(minutos/60):minutos).div(modalidad==='POR_HORA'?1:60).toDecimalPlaces(2);
  return {minutos,total};
}
function demo() {
  if(process.env.PAGOS_SIMULADOS!=='1'||process.env.NODE_ENV==='production')throw new ServiceUnavailableException('Pagos simulados deshabilitados');
}
type Acceso={usuarioId:number}|{token:string};
@Injectable()
export class PagosService {
  constructor(private readonly db:PrismaService){}
  private async buscar(tx:Prisma.TransactionClient, acceso:Acceso, visitaId?:number) {
    const v='usuarioId' in acceso
      ? await tx.visitaVehiculo.findFirst({where:{id:visitaId,usuarioId:acceso.usuarioId,estado:{in:['DENTRO','PAGADO','SALIDA_AUTORIZADA']}},include:{ticket:{include:{pagos:true}}}})
      : await tx.visitaVehiculo.findFirst({where:{usuarioId:null,ticket:{tokenAccesoHash:hash(acceso.token)},estado:{in:['DENTRO','PAGADO','SALIDA_AUTORIZADA']}},include:{ticket:{include:{pagos:true}}}});
    if(!v)throw new NotFoundException('Visita activa no encontrada');
    return v;
  }
  private resumen(v:Awaited<ReturnType<PagosService['buscar']>>, ahora=new Date()) {
    const t=v.ticket;
    const vigente=!!(t?.estado==='PAGADO'&&t.fechaLimiteSalida&&t.fechaLimiteSalida>=ahora);
    const {minutos,total}=calcularCobro(v.fechaIngresoConfirmada??v.fechaIngreso,ahora,v.precioHoraAplicado??d(15),v.modalidadAplicada??'POR_MINUTO');
    const abonado=(t?.pagos??[]).filter(p=>p.estado==='CONFIRMADO').reduce((s,p)=>s.add(p.importe),d(0));
    const pendiente=vigente?d(0):Prisma.Decimal.max(0,total.sub(abonado));
    return {visitaId:v.id,placa:v.placa,estado:v.estado,fechaIngreso:v.fechaIngresoConfirmada??v.fechaIngreso,minutos,precioHora:Number(v.precioHoraAplicado??15),total:Number(vigente?t!.importeTotal:total),abonado:Number(abonado),pendiente:Number(pendiente),pagado:vigente,fechaLimiteSalida:t?.fechaLimiteSalida??null,ticketCodigo:t?.codigo??null};
  }
  async activas(usuarioId:number) {
    const rows=await this.db.visitaVehiculo.findMany({where:{usuarioId,estado:{in:['DENTRO','PAGADO','SALIDA_AUTORIZADA']}},include:{ticket:{include:{pagos:true}}},orderBy:{id:'desc'}});
    return rows.map(v=>this.resumen(v));
  }
  async historial(usuarioId:number) {
    return this.db.pago.findMany({where:{usuarioId,estado:'CONFIRMADO'},select:{id:true,referencia:true,importe:true,metodo:true,fechaConfirmacion:true,ticket:{select:{codigo:true,visita:{select:{placa:true}}}}},orderBy:{id:'desc'},take:100});
  }
  async billetera(usuarioId:number) {
    const w=await this.db.billetera.findUnique({where:{usuarioId},include:{movimientos:{orderBy:{id:'desc'},take:50}}});
    return {saldo:Number(w?.saldo??0),movimientos:w?.movimientos??[]};
  }
  async recargar(usuarioId:number, monto:unknown) {
    demo();
    if(typeof monto!=='number'||!Number.isFinite(monto)||monto<1||monto>500||Math.abs(monto*100-Math.round(monto*100))>0.00001)throw new BadRequestException('Recarga entre 1 y 500 Bs, maximo dos decimales');
    return this.db.$transaction(async tx=>{
      await tx.billetera.upsert({where:{usuarioId},create:{usuarioId},update:{}});
      await tx.$queryRaw`SELECT id FROM billeteras WHERE usuarioId = ${usuarioId} FOR UPDATE`;
      const w=await tx.billetera.findUniqueOrThrow({where:{usuarioId}});
      const saldo=w.saldo.add(monto);
      await tx.billetera.update({where:{id:w.id},data:{saldo}});
      await tx.movimientoBilletera.create({data:{billeteraId:w.id,referencia:ref(),tipo:'RECARGA',importe:d(monto),saldoAnterior:w.saldo,saldoPosterior:saldo}});
      return {saldo:Number(saldo),simulado:true};
    });
  }
  async emitirInvitado(placa:unknown) {
    demo();
    if(typeof placa!=='string'||!/^\d{4}[A-Z]{3}$/.test(placa.trim().toUpperCase()))throw new BadRequestException('Placa invalida');
    return this.db.$transaction(async tx=>{
      const v=await tx.visitaVehiculo.findUnique({where:{placaActiva:placa.trim().toUpperCase()}});
      if(!v||v.usuarioId!==null||!['DENTRO','PAGADO'].includes(v.estado))throw new NotFoundException('Invitado sin visita activa');
      await tx.$queryRaw`SELECT id FROM visitas_vehiculos WHERE id = ${v.id} FOR UPDATE`;
      const token=ref();
      const t=await tx.ticket.upsert({where:{visitaId:v.id},create:{visitaId:v.id,codigo:ref(),tokenAccesoHash:hash(token)},update:{tokenAccesoHash:hash(token)}});
      return {token,codigo:t.codigo,placa:v.placa,ruta:'/pago-invitado?token='+token};
    });
  }
  async consultarInvitado(token:string) {return this.resumen(await this.buscar(this.db,{token}));}
  async pagar(acceso:Acceso, visitaId:number|undefined, metodo:unknown) {
    demo();
    if(metodo!=='QR_SIMULADO'&&metodo!=='BILLETERA')throw new BadRequestException('Metodo invalido');
    if(metodo==='BILLETERA'&&!('usuarioId' in acceso))throw new BadRequestException('Invitado solo puede usar QR simulado');
    return this.db.$transaction(async tx=>{
      const inicial=await this.buscar(tx,acceso,visitaId);
      await tx.$queryRaw`SELECT id FROM visitas_vehiculos WHERE id = ${inicial.id} FOR UPDATE`;
      const v=await this.buscar(tx,acceso,inicial.id);
      if(v.id!==inicial.id)throw new ConflictException('Visita modificada');
      const ahora=new Date(), r=this.resumen(v,ahora);
      if(r.pagado)return {...r,simulado:true};
      const importe=d(r.pendiente);
      const t=await tx.ticket.upsert({where:{visitaId:v.id},create:{visitaId:v.id,codigo:ref(),tokenAccesoHash:hash(ref())},update:{}});
      let wallet:{id:number;saldo:Prisma.Decimal}|undefined;
      if(metodo==='BILLETERA'&&'usuarioId' in acceso){
        await tx.$queryRaw`SELECT id FROM billeteras WHERE usuarioId = ${acceso.usuarioId} FOR UPDATE`;
        const w=await tx.billetera.findUnique({where:{usuarioId:acceso.usuarioId}});
        if(!w||w.saldo.lt(importe))throw new ConflictException('Saldo insuficiente');
        wallet=w;
      }
      const p=await tx.pago.create({data:{ticketId:t.id,usuarioId:v.usuarioId,referencia:ref(),importe,metodo,estado:'CONFIRMADO',simulado:true,fechaConfirmacion:ahora}});
      if(wallet){
        const saldo=wallet.saldo.sub(importe);
        await tx.billetera.update({where:{id:wallet.id},data:{saldo}});
        await tx.movimientoBilletera.create({data:{billeteraId:wallet.id,pagoId:p.id,referencia:ref(),tipo:'PAGO',importe,saldoAnterior:wallet.saldo,saldoPosterior:saldo}});
      }
      const limite=new Date(+ahora+(v.toleranciaAplicadaMin??10)*60000);
      await tx.ticket.update({where:{id:t.id},data:{estado:'PAGADO',importeTotal:d(r.abonado).add(importe),minutosFacturados:r.minutos,fechaLimiteSalida:limite}});
      await tx.visitaVehiculo.update({where:{id:v.id},data:{estado:'PAGADO'}});
      return {...r,estado:'PAGADO',pagado:true,pendiente:0,abonado:r.abonado+Number(importe),fechaLimiteSalida:limite,ticketCodigo:t.codigo,referencia:p.referencia,simulado:true};
    },{isolationLevel:Prisma.TransactionIsolationLevel.ReadCommitted});
  }
}
