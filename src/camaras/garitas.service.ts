import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { EstacionamientosGateway } from '../tiempo-real/estacionamientos.gateway.js';

export const modoGaritas = () => process.env.GARITAS_MODO_AUTORIZADO === '1';
export const salidaDemo = () => process.env.GARITAS_SALIDA_DEMO === '1' && process.env.NODE_ENV !== 'production';
const zonas = ['ENTRADA', 'SALIDA'] as const;
type Zona = typeof zonas[number];
const fases = ['LIBRE','PRESENCIA','ABIERTA','PASO','CANCELADA'] as const;
type Fase = typeof fases[number];
type Estado = { id: string; fase: Fase };
type Presencia = { id: string; hasta: number };
const PRESENCIA_MS=3000, AUTORIZACION_MS=15000;
const idValido = /^[a-f0-9]{16}-[0-9]{1,10}$/;

function objeto(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new BadRequestException('Objeto requerido');
  return v as Record<string, unknown>;
}
export function leerEstado(v: unknown): Estado {
  const o=objeto(v);
  if (typeof o.id!=='string'||!fases.includes(o.fase as Fase)||
      (o.fase==='LIBRE'?o.id!=='':!idValido.test(o.id))) throw new BadRequestException('Estado de garita invalido');
  return {id:o.id,fase:o.fase as Fase};
}
export function leerOCR(v:unknown) {
  const o=objeto(v),placa=typeof o.placa==='string'?o.placa.trim().toUpperCase():'';
  if(!/^\d{4}[A-Z]{3}$/.test(placa)||!zonas.includes(o.zona as Zona)||
    typeof o.confirmaciones!=='number'||!Number.isInteger(o.confirmaciones)||o.confirmaciones<4||o.confirmaciones>100)
    throw new BadRequestException('OCR requiere placa 1234ABC, zona y cuatro confirmaciones');
  const zona=o.zona as Zona;
  const camara=typeof o.camaraId==='string'?o.camaraId.trim().toUpperCase():'CAM-'+zona;
  if(!/^[A-Z0-9_-]{1,32}$/.test(camara))throw new BadRequestException('Camara invalida');
  return {placa,zona,camara};
}

@Injectable()
export class GaritasService {
  private readonly presentes: Partial<Record<Zona,Presencia>>={};
  // Una sola instancia NestJS para la maqueta. Serializa OCR y sincronizaciones.
  private cola: Promise<unknown>=Promise.resolve();
  constructor(private readonly prisma:PrismaService,private readonly gateway:EstacionamientosGateway){}
  private serial<T>(fn:()=>Promise<T>):Promise<T>{
    const next=this.cola.then(fn,fn);
    this.cola=next.catch(()=>{});
    return next;
  }
  private tx<T>(fn:(tx:Prisma.TransactionClient)=>Promise<T>){
    return this.prisma.$transaction(fn,{isolationLevel:Prisma.TransactionIsolationLevel.ReadCommitted});
  }
  private negar(motivo:string){return {registrado:false,autorizado:false,motivo};}
  private authId(z:Zona,id:string){return z+'-'+id+'-AUTH';}
  async sincronizar(body:unknown){
    const o=objeto(body), entradas=zonas.map(z=>({z,...leerEstado(o[z])}));
    return this.serial(async()=>{
      const reply:string[]=[];
      for(const e of entradas){
        const {z,id,fase}=e;
        if(fase==='PRESENCIA')this.presentes[z]={id,hasta:Date.now()+PRESENCIA_MS};
        else delete this.presentes[z];
        if(fase==='LIBRE')continue;
        const auth=await this.prisma.eventoBarrera.findUnique({where:{eventoId:this.authId(z,id)}});
        if(fase==='PRESENCIA'){
          if(auth?.resultado==='AUTORIZADA'&&auth.venceEn&&+auth.venceEn>Date.now()&&auth.visitaId){
            const fin=await this.prisma.eventoBarrera.findUnique({where:{eventoId:z+'-'+id+'-FIN'}});
            if(!fin)reply.push(z+':ABRIR:'+id);
          }
          continue;
        }
        if(fase==='ABIERTA'){
          if(auth?.visitaId)await this.prisma.eventoBarrera.upsert({
            where:{eventoId:z+'-'+id+'-OPEN'},update:{},
            create:{eventoId:z+'-'+id+'-OPEN',comandoId:id,zona:z,visitaId:auth.visitaId,tipoEvento:'APERTURA',resultado:'ABIERTA'},
          });
          continue;
        }
        // La placa solo se considera dentro/fuera al recibir el paso inferido
        // del IR y el cierre. CANCELADA significa que nunca se abrió.
        if(auth?.visitaId){
          await this.tx(async tx=>{
            const eventoId=z+'-'+id+'-FIN';
            if(await tx.eventoBarrera.findUnique({where:{eventoId}}))return;
            const visitaId=auth.visitaId!;
            if(fase==='PASO'){
              if(z==='ENTRADA'){
                const changed=await tx.visitaVehiculo.updateMany({where:{id:visitaId,estado:'PENDIENTE_INGRESO'},data:{estado:'DENTRO',fechaIngresoConfirmada:new Date(),fechaIngreso:new Date()}});
                if(changed.count){
                  const v=await tx.visitaVehiculo.findUniqueOrThrow({where:{id:visitaId}});
                  if(v.reservaId)await tx.reserva.updateMany({where:{id:v.reservaId,estado:'CONFIRMADA'},data:{estado:'EN_USO'}});
                }
              }else{
                const changed=await tx.visitaVehiculo.updateMany({where:{id:visitaId,estado:{in:['DENTRO','PAGADO','SALIDA_AUTORIZADA']},fechaSalida:null},data:{estado:'FINALIZADO',fechaSalida:new Date(),placaActiva:null,camaraSalida:'CAM-SALIDA'}});
                if(changed.count){
                  const v=await tx.visitaVehiculo.findUniqueOrThrow({where:{id:visitaId}});
                  if(v.reservaId)await tx.reserva.updateMany({where:{id:v.reservaId,estado:'EN_USO'},data:{estado:'FINALIZADA'}});
                  await tx.ticket.updateMany({where:{visitaId,estado:'PAGADO'},data:{estado:'CERRADO'}});
                }
              }
              await tx.eventoBarrera.create({data:{eventoId,comandoId:id,visitaId,zona:z,tipoEvento:'PASO_CONFIRMADO',resultado:'PASO_CONFIRMADO',motivo:'Paso inferido por IR y cierre local'}});
            }else{
              if(z==='ENTRADA')await tx.visitaVehiculo.updateMany({where:{id:visitaId,estado:'PENDIENTE_INGRESO'},data:{estado:'CANCELADA',placaActiva:null,reservaId:null}});
              await tx.eventoBarrera.create({data:{eventoId,comandoId:id,visitaId,zona:z,tipoEvento:'DENEGACION',resultado:'DENEGADA',motivo:'Presencia retirada sin apertura'}});
            }
          });
          this.gateway.publicarReservas();
        }
        // ACK aun si no hubo OCR; idempotente y permite nuevo vehiculo.
        reply.push(z+':ACK:'+id);
      }
      return reply.join('\n')||'OK';
    });
  }
  async reconocer(body:unknown){
    const {placa,zona,camara}=leerOCR(body);
    return this.serial(async()=>{
      const p=this.presentes[zona];
      if(!p||p.hasta<=Date.now())return this.negar('Sin presencia IR reciente; vuelve a presentar la placa');
      const eventoId=this.authId(zona,p.id);
      const previo=await this.prisma.eventoBarrera.findUnique({where:{eventoId},include:{visita:true}});
      if(previo){
        if(previo.visita?.placa!==placa)return this.negar('Garita ya asociada a otro vehiculo');
        return {registrado:false,autorizado:!!previo.venceEn&&+previo.venceEn>Date.now(),motivo:'Autorizacion ya emitida',visita:previo.visita};
      }
      const result=await this.tx(async tx=>{
        const ahora=new Date();
        const activa=await tx.visitaVehiculo.findUnique({where:{placaActiva:placa}});
        let visitaId:number;
        let motivo:string;
        if(zona==='ENTRADA'){
          if(activa)return this.negar('Vehiculo ya tiene visita abierta o pendiente');
          // Bloqueos en el mismo orden que las reservas: vehiculo y plazas.
          await tx.$queryRaw`SELECT id FROM vehiculos WHERE placa = ${placa} FOR UPDATE`;
          await tx.$queryRaw`SELECT id FROM estacionamientos ORDER BY id FOR UPDATE`;
          const vehiculo=await tx.vehiculo.findUnique({where:{placa}});
          if(vehiculo&&(!vehiculo.activo||vehiculo.estadoVerificacion!=='VERIFICADO'))return this.negar('Vehiculo registrado no verificado o inactivo');
          const reservas=await tx.reserva.findMany({where:{estado:{in:['CONFIRMADA','EN_USO']},fechaInicio:{lte:ahora},fechaFin:{gt:ahora}}});
          const propia=vehiculo?reservas.find(r=>r.vehiculoId===vehiculo.id&&r.estado==='CONFIRMADA'):undefined;
          const plazas=await tx.estacionamiento.findMany({where:{activo:true,ultimaLectura:{gte:new Date(+ahora-90000)}},include:{retencion:true}});
          const libres=plazas.filter(s=>s.estado==='LIBRE');
          const ocupadas=plazas.filter(s=>s.estado==='OCUPADO').length;
          const abiertas=await tx.visitaVehiculo.count({where:{placaActiva:{not:null},estado:{in:['PENDIENTE_INGRESO','DENTRO','PAGADO','SALIDA_AUTORIZADA']}}});
          if(Math.max(abiertas,ocupadas)>=plazas.filter(s=>s.estado!=='DESCONOCIDO').length)return this.negar('Sin capacidad confirmada');
          if(propia){
            if(!libres.some(s=>s.id===propia.estacionamientoId))return this.negar('Plaza reservada no disponible fisicamente');
            if(await tx.visitaVehiculo.findUnique({where:{reservaId:propia.id}}))return this.negar('Reserva ya vinculada a una visita');
          }else if(!libres.some(s=>!reservas.some(r=>r.estacionamientoId===s.id)&&!(s.retencion&&s.retencion.venceEn>ahora))){
            return this.negar('No hay plaza libre sin reserva vigente');
          }
          const tarifa=await tx.tarifa.findFirst({where:{activo:true,vigenteDesde:{lte:ahora},OR:[{vigenteHasta:null},{vigenteHasta:{gt:ahora}}]},orderBy:{vigenteDesde:'desc'}});
          const visita=await tx.visitaVehiculo.create({data:{
            placa,placaActiva:placa,camaraIngreso:camara,estado:'PENDIENTE_INGRESO',
            vehiculoId:vehiculo?.id,usuarioId:vehiculo?.usuarioId,reservaId:propia?.id,
            tarifaId:tarifa?.id,precioHoraAplicado:tarifa?.precioHora??new Prisma.Decimal(15),
            modalidadAplicada:tarifa?.modalidad??'POR_MINUTO',toleranciaAplicadaMin:tarifa?.toleranciaSalidaMin??10,
          }});
          visitaId=visita.id;motivo=propia?'Reserva vigente':vehiculo?'Cliente registrado':'Invitado';
        }else{
          if(!activa||!['DENTRO','PAGADO','SALIDA_AUTORIZADA'].includes(activa.estado))return this.negar('No existe ingreso confirmado para esta placa');
          const ticket=await tx.ticket.findUnique({where:{visitaId:activa.id}});
          const pagado=!!(ticket?.estado==='PAGADO'&&ticket.fechaLimiteSalida&&ticket.fechaLimiteSalida>=ahora);
          if(!pagado&&!salidaDemo())return this.negar('Pago pendiente; barrera cerrada');
          visitaId=activa.id;motivo=pagado?'Pago confirmado':'SALIDA_DEMO_SIN_COBRO';
        }
        const venceEn=new Date(Date.now()+AUTORIZACION_MS);
        await tx.eventoBarrera.create({data:{eventoId,comandoId:p.id,visitaId,zona,tipoEvento:'AUTORIZACION',resultado:'AUTORIZADA',motivo,venceEn}});
        return {registrado:true,autorizado:true,evento:'AUTORIZACION_'+zona,visitaId,venceEn,motivo};
      });
      return result;
    });
  }
}
