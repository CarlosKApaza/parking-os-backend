import {describe,it,expect} from 'vitest';
import {disponible,horario,solapa} from './reglas.js';
describe('reglas de reservas',()=>{
 const now=new Date('2026-11-24T12:00:00Z');
 it('rechaza lectura antigua salvo demo explícita',()=>{const p={activo:true,estado:'LIBRE',ultimaLectura:new Date(+now-100000)};expect(()=>disponible(p,now)).toThrow();expect(()=>disponible(p,now,true)).not.toThrow();expect(()=>disponible({...p,estado:'OCUPADO'},now,true)).toThrow()});
 it('acepta horarios futuros y rechaza invertidos',()=>{expect(horario('2026-11-25T09:00:00-04:00','2026-11-25T11:00:00-04:00',now).fechaInicio.toISOString()).toBe('2026-11-25T13:00:00.000Z');expect(()=>horario('2026-11-25T11:00:00-04:00','2026-11-25T09:00:00-04:00',now)).toThrow()});
 it('intervalos adyacentes no se solapan',()=>{const d=(n:number)=>new Date(n);expect(solapa(d(1),d(3),d(3),d(5))).toBe(false);expect(solapa(d(1),d(4),d(3),d(5))).toBe(true)});
});
