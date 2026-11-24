# Parking OS — Gestión de estacionamiento, fase 1

Rama feat/gestion-estacionamiento, basada en feat/camaras-ocr con WebSockets.
Modelo de 14 entidades. No se modifican los endpoints de sensores, su Gateway,
el firmware, Python ni las pantallas React en esta fase.

## Instalación segura (MySQL de desarrollo)

1. Detener NestJS. Iniciar MySQL en XAMPP. Hacer una copia de la BD.
2. npm install (la rama anterior añadió Socket.IO; actualiza el lock si hace falta).
3. npx prisma validate
4. npx prisma migrate status
5. npx prisma migrate deploy
6. npx prisma generate
7. npm run build && npm test (en PowerShell antiguo, ejecutar por separado).
8. npm run start:dev

La migración es aditiva: no elimina tablas ni filas. Agrega 11 tablas, amplía
visitas_vehiculos y crea la tarifa FERIA-BASE de Bs 15/h, POR_MINUTO, 10 min
de tolerancia y dos cámaras CAM-01 (entrada) y CAM-02 (salida).
Las URL de video son opcionales: no se almacenan credenciales ni IP inventadas.
No se crean cuentas con contraseñas por defecto. No ejecutar migrate reset.

## Modelo

- Usuario 1:N Vehiculo y Reserva; 1:0..1 Billetera.
- Estacionamiento 1:N EventoEstacionamiento y Reserva.
- Vehiculo, Usuario, Reserva y Tarifa se relacionan con VisitaVehiculo;
  los FK son opcionales en la fase de transición para conservar registros anteriores.
- Visita 1:0..1 Ticket; Ticket 1:N Pago; Billetera 1:N MovimientoBilletera.
- Camara 1:N LecturaOCR; Visita 1:N LecturaOCR y EventoBarrera.
- La zona ENTRADA/SALIDA es configuración de cámara, no una inferencia del OCR.
- Un evento de barrera puede no tener visita (por ejemplo denegación sin matrícula).

## Reglas a implementar en los servicios siguientes

1. No hay planes premium, tokens ni suscripciones. Roles CLIENTE y ADMINISTRADOR.
   Disponibilidad pública, datos personales privados. Billetera en Bs ficticios.
2. Matrícula normalizada única para la cuenta, asociación verificada antes de
   atribuir una visita a un usuario; visitante sin cuenta permitido.
3. Una sola visita activa por placa (placaActiva UNIQUE, NULL al cerrar/cancelar).
   Nuevas visitas se crean explícitamente PENDIENTE_INGRESO; ingreso facturable
   solo al confirmar el paso (fechaIngresoConfirmada). La fechaIngreso histórica
   sigue siendo el momento de registro por compatibilidad.
4. OCR: cuatro lecturas iguales, eventoId único, identidad de cámara autenticada;
   la zona se obtiene de MySQL. Un OCR en salida no equivale a salida física.
5. Tarifa de la visita congelada (ID, importe, modalidad y tolerancia); precio
   inicial Bs 15/h, minuto iniciado, Decimal y redondeo monetario a 2 decimales.
   Sin facturar antes del paso. No alterar tarifas históricas. Tras 10 min de
   tolerancia recalcular el total y descontar pagos confirmados, no cobrar dos veces.
6. Un ticket por visita; código público y secreto aleatorio de acceso (solo hash
   persistido) para visitantes. No usar matrícula sola para acceder a datos privados.
7. Pago ficticio únicamente; referencia única como clave de idempotencia.
   Confirmación, descuento de billetera y movimiento deben ser atómicos.
   No aceptar importe del cliente como autoridad ni permitir saldo negativo.
8. Reserva valida vehículo de la cuenta, fecha y ausencia de solapamiento;
   serializar la operación por plaza. Capacidad de entrada considera vehículos
   admitidos aún sin plaza, reservas y ocupación confirmada. No deducir identidad
   de un automóvil de un sensor de ocupación P1–P7.
9. Autorizar barrera solo con evento vigente, pago/capacidad y seguridad local.
   Confirmar paso por mecanismo físico aún pendiente de definir con la PCB.
   No enviar apertura real en esta fase. Registrar autorizaciones y resultados.
10. WebSockets públicos solo para ocupación; notificaciones personales por
    canales autenticados. Eventos después del commit, no antes.

## Transición del módulo de cámaras existente

El endpoint POST /camaras/lecturas anterior conserva su comportamiento de
prueba (3 confirmaciones y cierre por OCR), y las visitas que crea tienen
estado LEGADO. NO utilizar ese flujo para cobros ni barreras reales.
Los registros previos también quedan LEGADO y no se les inventa tarifa, cuenta
o confirmación física. La siguiente fase sustituirá el flujo por una máquina de
estados con 4 confirmaciones, identificador de evento, registro de cámara,
validación de capacidad, confirmación de paso y ticket. Al comenzar las nuevas
pruebas, resolver visitas LEGADO activas explícitamente antes de reutilizar la
misma matrícula; no borrar datos automáticamente.

## Alcance

Las tablas y restricciones únicas están definidas. Las reglas transaccionales
sobre reservas, billeteras, pagos, OCR y barreras NO están implementadas por
crear el esquema. Siguiente fase: autenticación y vehículos, después visitas,
tickets y pagos simulados. Pruebas y compilación se ejecutarán en el entorno local.
