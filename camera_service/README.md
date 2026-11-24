# Parking OS — dos cámaras, una terminal, OCR mediante IR

Este servicio reside en el repositorio **parking-os-backend**, rama **feat/camaras-ocr**.
Se ejecuta en la misma PC Windows que tiene conectadas la UVC de entrada y la W77 de salida.

## Diseño de clases (patrón estructural Fachada / Facade)

**ParkingCameraFacade** es la clase principal. Inicia y detiene:

- **CameraDevice**: dueño exclusivo de cada cv2.VideoCapture. Una captura por cámara; JPEG y fotogramas compartidos con todos los consumidores.
- **CameraHttpServer / CameraRequestHandler**: publica video MJPEG, imagen JPEG y salud por HTTP.
- **TriggeredOcrCoordinator**: espera un evento del IR, revisa fotogramas y necesita 3 coincidencias de una placa.
- **PlateReader / TesseractPlateReader**: adaptador OCR reemplazable por un modelo de placas YOLO + OCR más adelante.
- **NestBackendAdapter**: envía una placa confirmada a NestJS/MySQL. No activa servos.

Esquema:

    Webcam UVC -> CameraDevice ENTRADA -> :8765/video ----+
                               |                          |
                               +-> frame OCR              +-> PWA PC / celular
                                         |                |
    Webcam W77 -> CameraDevice SALIDA  -> :8766/video -----+
                               |
                               +-> frame OCR
                                         |
    IR entrada/salida -> HTTP /trigger -> TriggeredOcrCoordinator
                                         | (se activa solo con IR)
                                         v
                                  TesseractPlateReader
                                         |
                                  NestBackendAdapter
                                         |
                                  NestJS -> MySQL

La PWA existente de Seguridad conserva los mismos puertos y rutas:
- Cámara 01: http://IP_PC:8765/video, /snapshot.jpg, /health
- Cámara 02: http://IP_PC:8766/video, /snapshot.jpg, /health

## Paso 1. Actualizar código

Desde la carpeta local **servidor_backend**, revisa tus cambios locales antes de cambiar de rama.

    git status
    git branch --show-current
    git fetch origin
    git switch feat/camaras-ocr
    git pull --ff-only origin feat/camaras-ocr

Si Git te advierte sobre cambios sin confirmar, guárdalos o confírmalos primero: NO uses reset --hard.

## Paso 2. Python y dependencias

No uses la .venv vieja que no tiene cv2. Puedes invocar directamente Python global:

    py -3.14 -c "import cv2; import pytesseract; print('Dependencias Python OK')"

Si falla la importación:

    py -3.14 -m pip install -r .\camera_service\requirements.txt

El OCR requiere además el ejecutable Windows de Tesseract instalado en:
C:\Program Files\Tesseract-OCR\tesseract.exe
El programa intenta encontrarlo automáticamente.

## Paso 3. Ejecutar ambas cámaras con UN comando

Primero detén con Ctrl+C ambos procesos antiguos camaraSeguridadCompleta.py para liberar
las cámaras USB y los puertos 8765/8766.

Desde la carpeta servidor_backend:

    py -3.14 -u .\camera_service\parking_camera.py --entrada 1 --salida 2 --backend dshow --fps 20 --quality 70

El índice 1/2 se corresponde con tus últimas pruebas, pero Windows puede cambiar los índices.
No fuerces manualmente MJPEG ni resolución del driver: antes dio cuadros negros.

Comprueba en el navegador:

- http://127.0.0.1:8765/health
- http://127.0.0.1:8765/snapshot.jpg
- http://127.0.0.1:8766/health
- http://127.0.0.1:8766/snapshot.jpg

El frontend sigue disponible en la ruta /seguridad sin cambios. La PC y el celular
deben estar en la misma Wi-Fi privada. Usa la IP real actual de la PC.

## Paso 4. Reconocer placas SOLO cuando pase un vehículo por el IR

Esta versión prepara el endpoint que deberá llamar el ESP32. NO está conectado
físicamente todavía: tu firmware necesita enviar el evento al detectar el IR de entrada
o el de salida, que son sensores distintos de los 7 IR que cuentan plazas ocupadas.

Para evitar que cualquiera active el OCR, define una clave privada en la terminal
ANTES del comando de arranque:

    $env:CAMERA_TRIGGER_KEY="CLAVE_IR_ALEATORIA_DE_AL_MENOS_16_CARACTERES"
    py -3.14 -u .\camera_service\parking_camera.py --entrada 1 --salida 2 --backend dshow

En Postman o Thunder Client puedes simular un evento IR, sin utilizar curl:

Entrada:
- POST http://127.0.0.1:8765/trigger
- Header: x-trigger-key = CLAVE_IR_ALEATORIA_DE_AL_MENOS_16_CARACTERES
- Header: Content-Type = application/json
- Body: {"zona":"ENTRADA"}

Salida:
- POST http://127.0.0.1:8766/trigger
- Mismos headers
- Body: {"zona":"SALIDA"}

Código 202 significa evento aceptado, NO placa reconocida aún.

Al recibir un evento, el worker OCR:
1. Toma copias de los frames existentes (nunca vuelve a abrir la cámara).
2. Durante máximo 8 segundos busca una placa del formato de la maqueta: 1234ABC.
3. Requiere 3 lecturas iguales.
4. Puede enviar el evento a NestJS y finaliza.
5. Espera otro IR; el video nunca deja de transmitirse.

Hay antirrebote de 10 segundos. Estado diagnóstico:
http://127.0.0.1:8765/ocr-status y http://127.0.0.1:8766/ocr-status.

### Región de interés (ROI) del OCR

Tesseract es el OCR existente; todavía NO es un detector entrenado con YOLO.
Si la matrícula es pequeña, OCR sobre la imagen completa no será fiable.
Se puede acotar el recorte con coordenadas normalizadas de 0 a 1.

Ejemplo orientativo (debes calibrarlo con tu maqueta):

    py -3.14 -u .\camera_service\parking_camera.py --entrada 1 --salida 2 --backend dshow --roi-entrada "0.2,0.3,0.8,0.7" --roi-salida "0.2,0.3,0.8,0.7"

Para incorporar posteriormente el modelo entrenado, implementa la interfaz
PlateReader.read(frame, roi) sin modificar CameraDevice, HTTP ni la Fachada.

## Paso 5. Integración opcional con NestJS/MySQL

La rama feat/camaras-ocr ya tiene la tabla visitas_vehiculos y el endpoint
POST /camaras/lecturas. El backend exige CAMERA_API_KEY (mínimo 16 caracteres)
en servidor_backend/.env y el mismo valor en la terminal Python.

En la terminal Python:

    $env:CAMERA_API_URL="http://127.0.0.1:3000/camaras/lecturas"
    $env:CAMERA_API_KEY="MISMA_CLAVE_QUE_EN_BACKEND_ENV"
    $env:CAMERA_TRIGGER_KEY="CLAVE_IR_INDEPENDIENTE"
    py -3.14 -u .\camera_service\parking_camera.py --entrada 1 --salida 2 --backend dshow

Sin CAMERA_API_URL o CAMERA_API_KEY, el OCR corre en modo local sin insertar en MySQL.
Con claves válidas, una placa de ENTRADA confirmada se registra con fecha de ingreso.

**Importante: SALIDA no cierra la visita por defecto.** El método actual de NestJS
cerraría la visita en cuanto detecta la placa, ANTES de pagar. El flujo correcto es:
identificar vehículo -> calcular deuda -> QR único y temporal -> pago confirmado ->
autorizar servo -> detectar cruce -> cerrar visita.

La opción --demo-close-on-exit solo sirve para una demo sin cobro. Evítala al integrar
pagos reales. Ni el OCR ni el stream levantan los servomotores automáticamente.

## Pruebas sin cámaras

Desde servidor_backend:

    py -3.14 -m unittest discover -s camera_service/tests -v

Estas pruebas usan lectores y cámaras falsas para verificar el antirrebote, la fachada
y que la salida NO cierra una visita sin pago.

## Precauciones

El streaming del prototipo no tiene autenticación: cualquiera con acceso a la Wi-Fi
privada y la URL puede verlo. No redirigir los puertos hacia Internet. Nunca exponer
CAMERA_API_KEY ni CAMERA_TRIGGER_KEY en variables VITE_ ni subirlas a GitHub.
Para producción serían necesarios autenticación, HTTPS y políticas de privacidad.
