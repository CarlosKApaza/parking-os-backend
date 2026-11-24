import { Logger } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Server } from 'socket.io';
import type { Estacionamiento } from '@prisma/client';

export const EVENTO_ESTACIONAMIENTO = 'estacionamiento.actualizado';

// Solo publica ocupación de plazas. No expone matrículas, pagos ni control
// de barreras. No hay eventos entrantes que permitan modificar los sensores.
@WebSocketGateway({ transports: ['websocket'] })
export class EstacionamientosGateway {
  private readonly logger = new Logger(EstacionamientosGateway.name);
  @WebSocketServer()
  server?: Server;

  publicarReservas(): void {
    try { this.server?.emit('reservas.actualizadas', { fecha: new Date().toISOString() }); }
    catch (error) { this.logger.warn('No se pudo difundir disponibilidad: ' + String(error)); }
  }

  publicar(plaza: Estacionamiento): void {
    const lectura = {
      codigo: plaza.codigo,
      sensorCodigo: plaza.sensorCodigo,
      estado: plaza.estado,
      activo: plaza.activo,
      ultimaLectura: plaza.ultimaLectura?.toISOString() ?? null,
      fechaCambio: plaza.fechaCambio.toISOString(),
    };
    try {
      this.server?.emit(EVENTO_ESTACIONAMIENTO, lectura);
    } catch (error) {
      // La transacción ya fue confirmada; no responder un error de escritura
      // por un fallo de difusión. El cliente puede recuperar el estado por REST.
      this.logger.warn('No se pudo difundir la lectura: ' + String(error));
    }
  }
}
