# Autenticación y clientes — feria

Instalar con npm install (actualiza package-lock.json), generar JWT_SECRET aleatoria con
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
y agregarla al .env sin modificar DATABASE_URL ni CAMERA_API_KEY. No subir .env.
La API no requiere JWT para consultar ocupación, ni cambia Socket.IO público.
JWT HS256 con jose, expiración 1 h, emisor y audiencia; contraseña scrypt con sal aleatoria.
Registro público siempre CLIENTE y billetera 0. Login devuelve accessToken, tokenType,
expiresIn y usuario. Guard verifica firma y cuenta activa en BD. No hay renovación aún.
La red HTTP local es solo para maqueta con credenciales ficticias; producción exige HTTPS.

## Seed opcional
Con MySQL activo y migración aplicada:
PowerShell: $env:DEMO_SEED="1"; npm run seed:demo
Opcional: antes, definir DEMO_ADMIN_PASSWORD local con contraseña diferente, mínimo 12 caracteres.
Quitar las variables de la sesión después. No habilitar en producción.
Alex alex@parkingos.test 8520PHD Bs150, María maria@parkingos.test 1234ABC Bs100,
Daniel daniel@parkingos.test 4567XYZ Bs200. Contraseña demo Parking123*.
Seed no resetea saldo, contraseña ni titularidad si se repite; placas de prueba verificadas.
No crea admin sin contraseña explícita. Nuevos registros de placa quedan PENDIENTE por defecto. En feria local, VEHICULOS_VERIFICACION_AUTOMATICA=1 habilita automáticamente nuevas matrículas válidas y únicas. Para una matrícula previamente pendiente, POST /vehiculos/:id/habilitar-demo con JWT del propietario registrado. No permite habilitar matrículas rechazadas ni ajenas. No acredita propiedad real; deshabilitado en NODE_ENV=production. El OCR integrado al flujo de acceso aún está pendiente.

## Postman, http://127.0.0.1:3000
POST /auth/registro {"nombre":"Eva","correo":"eva@parkingos.test","password":"Parking123*"}
POST /auth/login {"correo":"alex@parkingos.test","password":"Parking123*"}
GET /auth/me — Authorization: Bearer <accessToken>
PATCH /usuarios/perfil {"nombre":"Alex Demo"} — Bearer
GET /vehiculos — Bearer
POST /vehiculos {"placa":"9999ABC","marca":"Demo"} — Bearer
DELETE /vehiculos/:id — Bearer (baja lógica, historial preservado y no reasignable por el cliente).
Probar dos tokens: cada cuenta solo lista sus propios vehículos; intentar borrar vehículo ajeno -> 404.
Sin token o token inválido -> 401. Correo/placa duplicado -> 409.
Reservas concurrentes y frontend de autenticación ya integrados; pagos y autenticación privada de WebSocket pendientes.
Futuras operaciones de reserva/visita deben coordinar el bloqueo de vehículo y plaza.
