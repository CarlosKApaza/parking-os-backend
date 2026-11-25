# Disponibilidad consolidada

GET /estacionamientos/disponibilidad (publico, sin datos personales).

Devuelve `servidorAhora` y `plazas`, ordenadas por id. Cada plaza contiene su estado fisico original, ultimaLectura, lecturaVigente (90 segundos), estadoReserva, tipoReserva (SIN_RESERVA, FUTURA, EN_CURSO), estadoVisual, disponibleAhora, reserva, reservasFuturas y retencion. Las reservas incluyen solamente estado y fechas; las retenciones solo su vencimiento.

Precedencia visual: DESHABILITADO, DESCONOCIDO (incluye lectura antigua o ausente), OCUPADO, RESERVADO (horario en curso), RETENIDO, RESERVA_FUTURA, LIBRE. El modo local de simulacion de lecturas antiguas respeta RESERVAS_PERMITIR_LECTURA_ANTIGUA y no se admite en produccion.

Una reserva futura no bloquea la disponibilidad instantanea si la plaza esta fisicamente libre y sin retencion vigente. El intervalo de uso solicitado se valida en la confirmacion transaccional existente; disponibleAhora no garantiza un intervalo futuro ni autoriza la barrera. Las fechas se serializan en UTC. Una reserva es actual si fechaInicio <= ahora < fechaFin y su estado es activo, de acuerdo con /reservas/disponibilidad.

No se modifica GET /estacionamientos, GET /estacionamientos/resumen, GET /reservas/disponibilidad, firmware, WebSocket, frontend, esquema Prisma ni datos existentes.

Verificar: npm run build y npm test -- src/estacionamientos/disponibilidad.spec.ts.
