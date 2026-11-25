import { describe, expect, it } from 'vitest';
import { calcularDisponibilidad } from './disponibilidad.js';

const ahora = new Date('2026-11-25T06:50:00Z');
const minuto = 60_000;
const fecha = (offset: number) => new Date(+ahora + offset * minuto);
type Plaza = Parameters<typeof calcularDisponibilidad>[0];
const base: Plaza = {
  id: 1, codigo: 'P1', sensorCodigo: 'IR01', estado: 'LIBRE',
  activo: true, ultimaLectura: fecha(-0.5), reservas: [], retencion: null,
};
const reserva = (inicio: number, fin: number, estado: Plaza['reservas'][number]['estado'] = 'CONFIRMADA') =>
  ({ estado, fechaInicio: fecha(inicio), fechaFin: fecha(fin) });
const calcular = (cambios: Partial<Plaza> = {}, permitirAntigua = false) =>
  calcularDisponibilidad({ ...base, ...cambios }, ahora, permitirAntigua);

describe('disponibilidad consolidada de plazas', () => {
  it('distingue una plaza libre de una futura reserva', () => {
    expect(calcular()).toMatchObject({ estadoVisual: 'LIBRE', disponibleAhora: true });
    expect(calcular({ reservas: [reserva(10, 20)] })).toMatchObject({
      estadoFisico: 'LIBRE', estadoReserva: 'CONFIRMADA', tipoReserva: 'FUTURA',
      estadoVisual: 'RESERVA_FUTURA', disponibleAhora: true,
    });
  });
  it('bloquea una reserva durante su horario, incluso al inicio exacto', () => {
    expect(calcular({ reservas: [reserva(0, 10), reserva(20, 30)] })).toMatchObject({
      estadoVisual: 'RESERVADO', disponibleAhora: false, tipoReserva: 'EN_CURSO',
      reservasFuturas: [reserva(20, 30)],
    });
  });
  it('prioriza la ocupacion fisica y conserva la reserva', () => {
    expect(calcular({ estado: 'OCUPADO', reservas: [reserva(-5, 5)] })).toMatchObject({
      estadoVisual: 'OCUPADO', estadoReserva: 'CONFIRMADA', disponibleAhora: false,
    });
  });
  it('ignora reservas canceladas, vencidas y terminadas', () => {
    expect(calcular({ reservas: [reserva(-10, 0), reserva(-5, 5, 'CANCELADA'), reserva(-5, 5, 'VENCIDA'), reserva(-5, 5, 'FINALIZADA')] })).toMatchObject({
      estadoVisual: 'LIBRE', estadoReserva: null, disponibleAhora: true,
    });
  });
  it('distingue retencion vigente de expirada', () => {
    expect(calcular({ retencion: { venceEn: fecha(0.5) } })).toMatchObject({ estadoVisual: 'RETENIDO', disponibleAhora: false });
    expect(calcular({ retencion: { venceEn: ahora } })).toMatchObject({ estadoVisual: 'LIBRE', retencion: null });
  });
  it('no presenta lecturas viejas, desconocidas o inexistentes como disponibles', () => {
    expect(calcular({ ultimaLectura: fecha(-2) })).toMatchObject({ estadoFisico: 'LIBRE', lecturaVigente: false, estadoVisual: 'DESCONOCIDO', disponibleAhora: false });
    expect(calcular({ ultimaLectura: fecha(-2) }, true)).toMatchObject({ lecturaVigente: false, disponibleAhora: true });
    expect(calcular({ ultimaLectura: null }, true).disponibleAhora).toBe(false);
    expect(calcular({ estado: 'DESCONOCIDO' }).disponibleAhora).toBe(false);
    expect(calcular({ activo: false })).toMatchObject({ estadoVisual: 'DESHABILITADO', disponibleAhora: false });
  });
});
