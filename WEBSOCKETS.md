# Ocupación en tiempo real (fase 1)

Gateway Socket.IO sobre el mismo servidor HTTP de NestJS (puerto 3000), ruta /socket.io, namespace por defecto. Transporte websocket. No se cambian endpoints REST, firmware, Prisma ni migraciones.

## Instalación
En servidor_backend: npm install (actualiza también package-lock.json con las dependencias nuevas). Luego npm test, npm run build, npm run start:dev.

## Contrato
- GET /estacionamientos: estado inicial y resincronización.
- POST /sensores/lecturas: sin cambios de entrada ni respuesta.
- Evento servidor → cliente: estacionamiento.actualizado. Campos codigo, sensorCodigo, estado, activo, ultimaLectura, fechaCambio.
- Se emite después del commit de MySQL en cada lectura aceptada, incluidos reportes sin cambio. No se emite si la transacción falla.
- No admite órdenes entrantes, ni expone matrículas, pagos o barreras.

## Prueba
Iniciar MySQL y backend; iniciar frontend actualizado en modo ocupación live. Abrir dos pestañas de Espacios; probar con el ESP32 o POST /sensores/lecturas desde Postman con un código de sensor realmente registrado en la BD y ocupado true/false. Ambas pestañas deben actualizarse. En DevTools → Network → WS buscar /socket.io y los mensajes estacionamiento.actualizado. No habrá GET repetidos mientras el socket y la sincronización estén sanos. Desconectar backend y comprobar recuperación al reiniciar.

Red local de prototipo: no publicar el puerto de Socket.IO en Internet. Para producción falta autenticación y control de acceso; el evento solo contiene ocupación. Si se añaden eventos de vehículos/pagos deberán tener permisos y destinatarios apropiados.
