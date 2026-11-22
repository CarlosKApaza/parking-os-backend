# Parking OS — Integracion de camaras OCR (fase 1)

Esta rama conecta las placas ficticias de la maqueta con NestJS y MySQL sin modificar el control del ESP32. Hay **una UVC Camera comprobada (indice 1)**; la segunda camara de salida se puede incorporar mas adelante. La API no expone video en vivo ni realiza cobros.

## Arquitectura

```text
UVC Camera (entrada) -> Python + OpenCV + Tesseract OCR
                    -> POST /camaras/lecturas (x-camera-key)
                    -> NestJS CamarasModule -> Prisma -> MySQL visitas_vehiculos

UVC Camera (salida, futura) -> mismo proceso con zona SALIDA
                            -> POST /camaras/lecturas
                            -> cierra la visita por matricula
```

Los sensores infrarrojos seguiran registrando la ocupacion de P1-P7 en `/sensores/lecturas`. La lectura de placa identifica al vehiculo, **no demuestra que haya ocupado una plaza especifica**. Esa asociacion y el cobro se implementaran despues.

## Backend: primera ejecucion

1. Arrancar **MySQL en XAMPP** y verificar la base de datos `parking_os_sis460`.
2. En `servidor_backend/.env`, conservar `DATABASE_URL` y agregar `CAMERA_API_KEY` con una clave aleatoria de al menos 16 caracteres. No subir el archivo `.env`.
3. Generar la clave en Windows con: `py -c "import secrets; print(secrets.token_urlsafe(32))"`.
4. Desde `servidor_backend` ejecutar `npx prisma migrate deploy`, luego `npx prisma generate`.
5. Ejecutar `npm run start:dev`. API local: `http://127.0.0.1:3000`.

La migracion crea `visitas_vehiculos` con una clave unica `placaActiva`, que evita dos visitas abiertas de una misma matricula.

## Python: en la carpeta prueba_camara_usb

1. Usar el archivo `lector_placas_conectado.py` provisto junto con esta integracion. Es una version del lector automatico anterior, con envio HTTP.
2. Si ya funcionan los scripts de pruebas, **no reinstalar las bibliotecas**: OpenCV, pytesseract, Tesseract (programa externo).
3. En la terminal PowerShell del lector:

```powershell
$env:CAMERA_API_KEY="COPIA_EXACTA_DE_LA_CLAVE_DEL_BACKEND"
$env:CAMERA_API_URL="http://127.0.0.1:3000/camaras/lecturas"
py lector_placas_conectado.py --camera 1 --zona ENTRADA
```

Colocar `1234ABC` dentro del cuadro verde. Tras tres lecturas iguales el lector enviara un unico ingreso. En el video se muestra la respuesta de la API. La ausencia de placa rearma el detector. Si el servidor no responde, el script muestra el error y reintenta despues de un intervalo.

Con la unica UVC actual puedes **simular la salida** cerrando el programa y arrancando:

```powershell
py lector_placas_conectado.py --camera 1 --zona SALIDA
```

Cuando exista otra camara USB fisica, iniciar un **segundo proceso** con su indice distinto y `--zona SALIDA`. No intentes abrir la misma UVC dos veces simultaneamente.

## Rutas HTTP (todas requieren `x-camera-key`)

| Metodo | Ruta | Funcion |
|---|---|---|
| POST | `/camaras/lecturas` | Registrar placa confirmada en ENTRADA o SALIDA |
| GET | `/camaras/visitas` | Mostrar las ultimas 30 visitas |
| GET | `/camaras/activos` | Mostrar vehiculos dentro del estacionamiento |

Ejemplo en Postman: `POST http://127.0.0.1:3000/camaras/lecturas`

Encabezados: `x-camera-key: TU_CLAVE`, `Content-Type: application/json`.

```json
{"placa":"1234ABC","zona":"ENTRADA","camaraId":"UVC-ENTRADA","confirmaciones":3}
```

Luego prueba otra peticion con `"zona":"SALIDA"`. La API devuelve fecha de entrada, fecha de salida y duracion en minutos. **No devuelve cobro real, QR, ni autoriza levantar la barrera**.

## Seguridad y limites

- La clave es **solo para el proceso Python y las consultas tecnicas en Postman**. No escribirla en variables `VITE_*`, JavaScript del navegador ni compartirla en capturas.
- El backend solo recibe texto de una matricula confirmada; no transmite ni almacena las imagenes de la webcam.
- La ROI sigue siendo fija (constante `ROI` del lector Python); aun no existe deteccion automatica de la posicion de la placa con YOLO.
- Para placas reales, la autenticacion, la correccion del OCR, el control de acceso al video, la autorizacion por usuario y la gestion de datos personales requeriran trabajo adicional.
- Con una sola UVC, la prueba real simultanea de entrada y salida todavia NO esta disponible.
