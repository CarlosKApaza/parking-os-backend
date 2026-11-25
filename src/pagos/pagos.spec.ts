import { describe,it,expect } from 'vitest';
import { Prisma } from '@prisma/client';
import { calcularCobro } from './pagos.service.js';
describe('tarifa de estacionamiento',()=>{
  const inicio=new Date(0),p=new Prisma.Decimal(15);
  it('cobra 0.25 por minuto',()=>expect(calcularCobro(inicio,new Date(60000),p,'POR_MINUTO').total.toString()).toBe('0.25'));
  it('redondea al minuto iniciado',()=>expect(calcularCobro(inicio,new Date(60001),p,'POR_MINUTO').total.toString()).toBe('0.5'));
  it('cobra 15 por hora completa',()=>expect(calcularCobro(inicio,new Date(3600000),p,'POR_MINUTO').total.toString()).toBe('15'));
});
