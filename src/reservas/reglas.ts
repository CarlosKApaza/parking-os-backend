import { BadRequestException, ConflictException } from '@nestjs/common';
export const HOLD_MS=30_000;
export const ESTADOS_ACTIVOS=['PENDIENTE','CONFIRMADA','EN_USO'] as const;
export function horario(inicio:unknown,fin:unknown,now=new Date()){
  const parse=(v:unknown)=>{if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/.test(v))throw new BadRequestException('Fecha ISO con zona horaria requerida.');const d=new Date(v);if(!Number.isFinite(+d))throw new BadRequestException('Fecha inválida.');return d};
  const a=parse(inicio),b=parse(fin);
  if(+a<=+now||+b<=+a||+b-+a>24*3600000||+a-+now>30*86400000)throw new BadRequestException('El horario debe ser futuro, de hasta 24 horas y dentro de 30 días.');
  return {fechaInicio:a,fechaFin:b};
}
export function solapa(a:Date,b:Date,c:Date,d:Date){return a<d&&b>c}
export function disponible(p:{activo:boolean;estado:string;ultimaLectura:Date|null},now:Date,allowOld=false){
  if(!p.activo||p.estado!=='LIBRE'||!p.ultimaLectura)throw new ConflictException('La plaza no tiene disponibilidad física confirmada.');
  if(!allowOld&&+now-+p.ultimaLectura>90000)throw new ConflictException('Lectura antigua. Actualiza el sensor antes de reservar.');
}
