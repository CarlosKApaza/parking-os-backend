import { describe, expect, it, vi } from 'vitest';
import { GaritasService, leerEstado, leerOCR } from './garitas.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { EstacionamientosGateway } from '../tiempo-real/estacionamientos.gateway.js';
const id='abcdef0123456789-1';
describe('garitas: contrato y presencia',()=>{
  it('valida identificador y fase',()=>{
    expect(leerEstado({id,fase:'PRESENCIA'})).toEqual({id,fase:'PRESENCIA'});
    expect(()=>leerEstado({id:'',fase:'PRESENCIA'})).toThrow();
    expect(()=>leerEstado({id,fase:'LIBRE'})).toThrow();
  });
  it('exige cuatro confirmaciones OCR',()=>{
    expect(()=>leerOCR({placa:'1234ABC',zona:'ENTRADA',confirmaciones:3})).toThrow();
    expect(leerOCR({placa:'1234abc',zona:'ENTRADA',confirmaciones:4}).placa).toBe('1234ABC');
  });
  it('rechaza OCR sin presencia sin consultar la base',async()=>{
    const s=new GaritasService({} as PrismaService,{} as EstacionamientosGateway);
    expect(await s.reconocer({placa:'1234ABC',zona:'ENTRADA',confirmaciones:4})).toMatchObject({autorizado:false});
  });
  it('presencia sola no concede apertura; cancelacion recibe ACK',async()=>{
    const db={eventoBarrera:{findUnique:vi.fn().mockResolvedValue(null)}};
    const s=new GaritasService(db as unknown as PrismaService,{} as EstacionamientosGateway);
    const libre={id:'',fase:'LIBRE'};
    expect(await s.sincronizar({ENTRADA:{id,fase:'PRESENCIA'},SALIDA:libre})).toBe('OK');
    expect(await s.sincronizar({ENTRADA:{id,fase:'CANCELADA'},SALIDA:libre})).toBe('ENTRADA:ACK:'+id);
  });
  it('solo devuelve autorizacion vigente y sin finalizar',async()=>{
    const db={eventoBarrera:{findUnique:vi.fn().mockResolvedValueOnce({resultado:'AUTORIZADA',venceEn:new Date(Date.now()+10000),visitaId:1}).mockResolvedValueOnce(null)}};
    const s=new GaritasService(db as unknown as PrismaService,{} as EstacionamientosGateway);
    expect(await s.sincronizar({ENTRADA:{id,fase:'PRESENCIA'},SALIDA:{id:'',fase:'LIBRE'}})).toBe('ENTRADA:ABRIR:'+id);
  });
});
