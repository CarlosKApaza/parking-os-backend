import type { EstadoOcupacion, EstadoReserva } from '@prisma/client';
import { ESTADOS_ACTIVOS } from '../reservas/reglas.js';

export const MAX_EDAD_LECTURA_MS = 90_000;

type ReservaPublica = {
  estado: EstadoReserva;
  fechaInicio: Date;
  fechaFin: Date;
};

type PlazaDisponibilidad = {
  id: number;
  codigo: string;
  sensorCodigo: string | null;
  estado: EstadoOcupacion;
  activo: boolean;
  ultimaLectura: Date | null;
  reservas: ReservaPublica[];
  retencion: { venceEn: Date } | null;
};

// Vista informativa: la autorización de una reserva sigue siendo transaccional.
export function calcularDisponibilidad(
  plaza: PlazaDisponibilidad,
  ahora: Date,
  permitirLecturaAntigua = false,
) {
  const vigentes = plaza.reservas
    .filter(r => ESTADOS_ACTIVOS.some(e => e === r.estado) && r.fechaFin > ahora)
    .sort((a, b) => +a.fechaInicio - +b.fechaInicio);
  const actual = vigentes.find(r => r.fechaInicio <= ahora) ?? null;
  const futuras = vigentes.filter(r => r.fechaInicio > ahora);
  const reserva = actual ?? futuras[0] ?? null;
  const retencion = plaza.retencion && plaza.retencion.venceEn > ahora
    ? { venceEn: plaza.retencion.venceEn }
    : null;

  const lecturaVigente = plaza.ultimaLectura !== null &&
    +ahora - +plaza.ultimaLectura <= MAX_EDAD_LECTURA_MS;
  const lecturaAceptada = plaza.ultimaLectura !== null &&
    (lecturaVigente || permitirLecturaAntigua);
  const disponibleAhora = plaza.activo && plaza.estado === 'LIBRE' &&
    lecturaAceptada && !actual && !retencion;

  const estadoVisual = !plaza.activo ? 'DESHABILITADO'
    : !lecturaAceptada || plaza.estado === 'DESCONOCIDO' ? 'DESCONOCIDO'
    : plaza.estado === 'OCUPADO' ? 'OCUPADO'
    : actual ? 'RESERVADO'
    : retencion ? 'RETENIDO'
    : futuras.length ? 'RESERVA_FUTURA'
    : 'LIBRE';

  return {
    id: plaza.id,
    codigo: plaza.codigo,
    sensorCodigo: plaza.sensorCodigo,
    activo: plaza.activo,
    estadoFisico: plaza.estado,
    ultimaLectura: plaza.ultimaLectura,
    lecturaVigente,
    estadoReserva: reserva?.estado ?? null,
    tipoReserva: actual ? 'EN_CURSO' : reserva ? 'FUTURA' : 'SIN_RESERVA',
    estadoVisual,
    disponibleAhora,
    reserva,
    reservasFuturas: futuras,
    retencion,
  };
}
