import { describe, expect, it, vi } from 'vitest';
import { SensoresService } from './sensores.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { EstacionamientosGateway } from '../tiempo-real/estacionamientos.gateway.js';

describe('SensoresService: difusión tras confirmar MySQL', () => {
  function setup(estado: 'LIBRE' | 'OCUPADO', fail = false) {
    const plaza = { id: 1, codigo: 'P1', sensorCodigo: 'IR01', estado, activo: true };
    const actualizado = { ...plaza, estado: 'OCUPADO', ultimaLectura: new Date(), fechaCambio: new Date() };
    let committed = false;
    const tx = {
      estacionamiento: { findUnique: vi.fn().mockResolvedValue(plaza), update: vi.fn().mockResolvedValue(actualizado) },
      eventoEstacionamiento: { create: vi.fn().mockResolvedValue({}) },
    };
    const prisma = { $transaction: vi.fn(async (fn: (value: typeof tx) => Promise<unknown>) => {
      const result = await fn(tx);
      if (fail) throw new Error('rollback');
      committed = true;
      return result;
    }) };
    const publicar = vi.fn(() => { expect(committed).toBe(true); });
    const service = new SensoresService(prisma as unknown as PrismaService, { publicar } as unknown as EstacionamientosGateway);
    return { service, tx, publicar, actualizado };
  }

  it('publica una lectura después de confirmar la transacción', async () => {
    const { service, tx, publicar, actualizado } = setup('LIBRE');
    const response = await service.registrarLectura('IR01', true);
    expect(response.cambioRegistrado).toBe(true);
    expect(tx.eventoEstacionamiento.create).toHaveBeenCalledTimes(1);
    expect(publicar).toHaveBeenCalledWith(actualizado);
  });
  it('registra el origen fisico del ESP32', async () => {
    const { service, tx } = setup('LIBRE');
    await service.registrarLectura('IR01', true, 'SENSOR_IR');
    expect(tx.eventoEstacionamiento.create).toHaveBeenCalledWith({ data: expect.objectContaining({ origen: 'SENSOR_IR' }) });
  });
  it('publica también reportes sin cambio de ocupación', async () => {
    const { service, tx, publicar } = setup('OCUPADO');
    expect((await service.registrarLectura('IR01', true)).cambioRegistrado).toBe(false);
    expect(tx.eventoEstacionamiento.create).not.toHaveBeenCalled();
    expect(publicar).toHaveBeenCalledTimes(1);
  });
  it('no publica una transacción rechazada', async () => {
    const { service, publicar } = setup('LIBRE', true);
    await expect(service.registrarLectura('IR01', true)).rejects.toThrow('rollback');
    expect(publicar).not.toHaveBeenCalled();
  });
});
