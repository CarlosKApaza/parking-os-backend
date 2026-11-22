import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CamarasService } from './camaras.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('CamarasService - placas de prueba', () => {
  const visita = {
    id: 1,
    placa: '1234ABC',
    placaActiva: '1234ABC',
    fechaIngreso: new Date('2026-11-21T20:00:00.000Z'),
    fechaSalida: null,
    camaraIngreso: 'UVC-ENTRADA',
    camaraSalida: null,
  };
  const db = {
    visitaVehiculo: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
  };
  const service = new CamarasService(db as unknown as PrismaService);
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CAMERA_API_KEY = 'clave-segura-de-pruebas';
  });

  it('rechaza la clave ausente o incorrecta', () => {
    expect(() => service.autorizar(undefined)).toThrow();
    expect(() => service.autorizar('otra-clave')).toThrow();
    expect(() => service.autorizar('clave-segura-de-pruebas')).not.toThrow();
  });

  it('requiere tres lecturas iguales antes de registrar', async () => {
    await expect(service.registrarLectura({
      placa: '1234ABC', zona: 'ENTRADA', confirmaciones: 2,
    })).rejects.toThrow();
    expect(db.visitaVehiculo.create).not.toHaveBeenCalled();
  });

  it('registra una unica entrada por placa', async () => {
    db.visitaVehiculo.findUnique.mockResolvedValue(null);
    db.visitaVehiculo.create.mockResolvedValue(visita);
    const result = await service.registrarLectura({
      placa: '1234abc', zona: 'ENTRADA', camaraId: 'UVC-ENTRADA', confirmaciones: 3,
    });
    expect(result.registrado).toBe(true);
    expect(result.evento).toBe('INGRESO');
    expect(db.visitaVehiculo.create).toHaveBeenCalledWith({
      data: { placa: '1234ABC', placaActiva: '1234ABC', camaraIngreso: 'UVC-ENTRADA' },
    });
    db.visitaVehiculo.findUnique.mockResolvedValue(visita);
    const repetido = await service.registrarLectura({ placa: '1234ABC', zona: 'ENTRADA', confirmaciones: 3 });
    expect(repetido.registrado).toBe(false);
    expect(db.visitaVehiculo.create).toHaveBeenCalledTimes(1);
  });

  it('cierra la visita al reconocer la misma placa en salida', async () => {
    db.visitaVehiculo.findUnique.mockResolvedValue(visita);
    db.visitaVehiculo.updateMany.mockResolvedValue({ count: 1 });
    db.visitaVehiculo.findUniqueOrThrow.mockResolvedValue({
      ...visita, placaActiva: null, fechaSalida: new Date('2026-11-21T20:30:00.000Z'), camaraSalida: 'UVC-SALIDA',
    });
    const result = await service.registrarLectura({
      placa: '1234ABC', zona: 'SALIDA', camaraId: 'UVC-SALIDA', confirmaciones: 3,
    });
    expect(result.registrado).toBe(true);
    expect(result.evento).toBe('SALIDA');
    expect(result.duracionMinutos).toBe(30);
    expect(db.visitaVehiculo.updateMany).toHaveBeenCalledTimes(1);
  });
});
