"""Parking OS — dos webcams, un proceso, streaming permanente y OCR bajo demanda.

Patrón estructural: Facade (ParkingCameraFacade).
- CameraDevice abre una webcam exactamente UNA vez.
- CameraHttpServer comparte el último JPEG con todos los navegadores.
- TriggeredOcrCoordinator analiza COPIAS de los fotogramas al recibir un IR.
- NestBackendAdapter comunica lecturas confirmadas a NestJS (no controla servos).

Compatible con Python 3.11+ en Windows; cámara dshow o msmf.
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import queue
import re
import secrets
import signal
import threading
import time
from collections import Counter
from dataclasses import dataclass
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Protocol
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen


LOG = logging.getLogger("parking-camera")
PLATE_RE = re.compile(r"\d{4}[A-Z]{3}")


@dataclass(frozen=True)
class CameraConfig:
    zone: str
    index: int
    port: int
    backend: str = "dshow"
    fps: int = 20
    quality: int = 70


class CameraDevice:
    """Único propietario de cv2.VideoCapture; emite JPEG y copia para OCR."""

    def __init__(self, config: CameraConfig):
        self.config = config
        self.cond = threading.Condition()
        self._frame: Any = None
        self._jpeg: bytes | None = None
        self._sequence = 0
        self._updated_at = 0.0
        self._capturing = False
        self._stop = threading.Event()
        self._thread = threading.Thread(
            target=self._capture_loop, name=f"capture-{config.zone}", daemon=True
        )

    def start(self) -> None:
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        with self.cond:
            self.cond.notify_all()
        if self._thread.is_alive():
            self._thread.join(timeout=4)

    def is_online(self) -> bool:
        with self.cond:
            return self._capturing and (time.monotonic() - self._updated_at) < 3

    def health(self) -> dict[str, Any]:
        with self.cond:
            online = self._capturing and time.monotonic() - self._updated_at < 3
            age = round((time.monotonic() - self._updated_at) * 1000) if self._updated_at else None
            return {
                "online": online,
                "zona": self.config.zone,
                "camara": self.config.index,
                "backend": self.config.backend,
                "resolucion": "segun controlador",
                "ultimoFotogramaMs": age,
            }

    def snapshot(self) -> bytes | None:
        with self.cond:
            if time.monotonic() - self._updated_at >= 3:
                return None
            return self._jpeg

    def frame_for_ocr(self) -> tuple[int, Any]:
        with self.cond:
            if self._frame is None or time.monotonic() - self._updated_at >= 3:
                return self._sequence, None
            return self._sequence, self._frame.copy()

    def wait_for_jpeg(self, previous: int, timeout: float = 2) -> tuple[int, bytes | None]:
        with self.cond:
            self.cond.wait_for(
                lambda: self._sequence != previous or self._stop.is_set(), timeout=timeout
            )
            if time.monotonic() - self._updated_at >= 3:
                return self._sequence, None
            return self._sequence, self._jpeg

    def _capture_loop(self) -> None:
        try:
            import cv2  # Se importa dentro del worker: tests sin webcam.
        except ImportError:
            LOG.error("[%s] Falta OpenCV. Ejecuta: py -3.14 -m pip install opencv-python",
                      self.config.zone)
            return

        backends = {"dshow": cv2.CAP_DSHOW, "msmf": cv2.CAP_MSMF}
        selected = backends[self.config.backend]

        while not self._stop.is_set():
            cap = cv2.VideoCapture(self.config.index, selected)
            if not cap.isOpened():
                LOG.warning("[%s] No abre la webcam %d (%s); reintento en 2 s",
                            self.config.zone, self.config.index, self.config.backend)
                cap.release()
                self._stop.wait(2)
                continue
            LOG.info("[%s] Webcam abierta, indice=%d, resolucion=%dx%d",
                     self.config.zone, self.config.index,
                     int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)),
                     int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)))
            try:
                while not self._stop.is_set():
                    begin = time.monotonic()
                    ok, frame = cap.read()
                    if not ok or frame is None:
                        LOG.warning("[%s] Perdida de captura; reintentando", self.config.zone)
                        break

                    # Un lente tapado no debe anunciarse como "En vivo".
                    # No forzar formato MJPG/FPS del driver; antes causó imagen negra.
                    mean, std = cv2.meanStdDev(frame)
                    if float(mean.mean()) < 1.5 and float(std.mean()) < 1.5:
                        self._stop.wait(.15)
                        continue

                    encoded, buffer = cv2.imencode(
                        ".jpg", frame,
                        [int(cv2.IMWRITE_JPEG_QUALITY), self.config.quality],
                    )
                    if encoded:
                        with self.cond:
                            self._frame = frame
                            self._jpeg = buffer.tobytes()
                            self._sequence += 1
                            self._updated_at = time.monotonic()
                            self._capturing = True
                            self.cond.notify_all()
                    self._stop.wait(max(0.0, 1 / self.config.fps - (time.monotonic() - begin)))
            finally:
                cap.release()
                with self.cond:
                    self._capturing = False
                    self.cond.notify_all()
            self._stop.wait(1.5)


class PlateReader(Protocol):
    """Adapter de OCR: reemplazable por YOLO + OCR sin cambiar video ni API."""

    def read(self, frame: Any, roi: tuple[float, float, float, float]) -> str | None:
        ...


class TesseractPlateReader:
    """Adaptador del OCR de demostracion (4 numeros + 3 letras). NO es YOLO."""

    def __init__(self, executable: str | None = None):
        self.executable = executable

    def read(self, frame: Any, roi: tuple[float, float, float, float]) -> str | None:
        import cv2
        import pytesseract

        if self.executable:
            pytesseract.pytesseract.tesseract_cmd = self.executable

        height, width = frame.shape[:2]
        x1, y1, x2, y2 = roi
        crop = frame[
            round(y1 * height):round(y2 * height),
            round(x1 * width):round(x2 * width),
        ]
        if crop.size == 0:
            return None
        gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
        gray = cv2.resize(gray, None, fx=1.8, fy=1.8, interpolation=cv2.INTER_CUBIC)
        gray = cv2.equalizeHist(gray)
        result = pytesseract.image_to_string(
            gray,
            config="--psm 7 -c tessedit_char_whitelist=0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ",
        )
        cleaned = re.sub(r"[^A-Z0-9]", "", result.upper())
        found = PLATE_RE.search(cleaned)
        return found.group(0) if found else None


class NestBackendAdapter:
    """Adapter REST: envía SOLO texto y confirmaciones, nunca imagenes."""

    def __init__(self, url: str | None, key: str | None, close_exit_in_demo: bool):
        self.url = url
        self.key = key
        self.close_exit_in_demo = close_exit_in_demo

    def report(self, zone: str, plate: str, count: int) -> str:
        if zone == "SALIDA" and not self.close_exit_in_demo:
            return "Salida reconocida; visita NO cerrada (falta cobro/confirmacion)"
        if not self.url:
            return "OCR confirmado localmente (backend no configurado)"
        if not self.key:
            return "OCR confirmado; falta CAMERA_API_KEY, NO se envio a NestJS"

        body = json.dumps({
            "placa": plate,
            "zona": zone,
            "camaraId": f"CAM-{zone}",
            "confirmaciones": count,
        }).encode("utf-8")
        req = Request(
            self.url,
            data=body,
            headers={
                "Content-Type": "application/json",
                "x-camera-key": self.key,
            },
            method="POST",
        )
        try:
            with urlopen(req, timeout=5) as res:
                payload = json.loads(res.read().decode("utf-8"))
            return f"Backend HTTP OK: registrado={payload.get('registrado')}"
        except (HTTPError, URLError, TimeoutError, ValueError) as error:
            return f"Error backend (no se abre barrera): {error}"


class TriggeredOcrCoordinator:
    """Un worker OCR, cola de eventos IR. Sin OCR mientras no haya activación."""

    def __init__(
        self,
        cameras: dict[str, CameraDevice],
        reader: PlateReader,
        backend: NestBackendAdapter,
        rois: dict[str, tuple[float, float, float, float]],
    ):
        self.cameras = cameras
        self.reader = reader
        self.backend = backend
        self.rois = rois
        self._events: queue.Queue[str] = queue.Queue(maxsize=4)
        self._pending: set[str] = set()
        self._last_trigger: dict[str, float] = {}
        self._state: dict[str, str] = {name: "esperando IR" for name in cameras}
        self._lock = threading.Lock()
        self._stop = threading.Event()
        self._thread = threading.Thread(target=self._run, name="ocr-worker", daemon=True)

    def start(self) -> None:
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        if self._thread.is_alive():
            self._thread.join(timeout=2)

    def status(self) -> dict[str, str]:
        with self._lock:
            return self._state.copy()

    def trigger(self, zone: str) -> tuple[bool, str]:
        cam = self.cameras.get(zone)
        if cam is None:
            return False, "Zona desconocida"
        if not cam.is_online():
            return False, "Camara sin video util"
        with self._lock:
            now = time.monotonic()
            if zone in self._pending:
                return False, "Reconocimiento ya en curso"
            if now - self._last_trigger.get(zone, -1e9) < 10:
                return False, "Cooldown IR: espera 10 segundos"
            if self._events.full():
                return False, "Cola de OCR llena"
            self._pending.add(zone)
            self._last_trigger[zone] = now
            self._state[zone] = "en cola"
            self._events.put_nowait(zone)
            return True, "OCR programado (video sigue disponible)"

    def _run(self) -> None:
        while not self._stop.is_set():
            try:
                zone = self._events.get(timeout=.3)
            except queue.Empty:
                continue
            try:
                self._recognize(zone)
            except Exception as error:
                LOG.exception("[OCR %s] Error, streaming independiente", zone)
                with self._lock:
                    self._state[zone] = f"error OCR: {type(error).__name__}"
            finally:
                with self._lock:
                    self._pending.discard(zone)
                self._events.task_done()

    def _recognize(self, zone: str) -> None:
        camera = self.cameras[zone]
        with self._lock:
            self._state[zone] = "reconociendo"
        votes: Counter[str] = Counter()
        previous = -1
        deadline = time.monotonic() + 8
        while time.monotonic() < deadline and not self._stop.is_set():
            seq, frame = camera.frame_for_ocr()
            if frame is None or seq == previous:
                self._stop.wait(.15)
                continue
            previous = seq
            plate = self.reader.read(frame, self.rois[zone])
            if plate:
                votes[plate] += 1
                LOG.info("[OCR %s] candidato=%s, confirmaciones=%d",
                         zone, plate, votes[plate])
                if votes[plate] >= 3:
                    result = self.backend.report(zone, plate, votes[plate])
                    LOG.info("[OCR %s] placa=%s, resultado=%s", zone, plate, result)
                    with self._lock:
                        self._state[zone] = "placa confirmada"
                    return
            self._stop.wait(.18)
        LOG.info("[OCR %s] Sin 3 coincidencias en 8 segundos", zone)
        with self._lock:
            self._state[zone] = "sin placa confirmada"


class CameraHttpServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True

    def __init__(self, facade: ParkingCameraFacade, zone: str):
        self.facade = facade
        self.zone = zone
        cam = facade.cameras[zone]
        super().__init__(("0.0.0.0", cam.config.port), CameraRequestHandler)


class CameraRequestHandler(BaseHTTPRequestHandler):
    server: CameraHttpServer
    protocol_version = "HTTP/1.1"

    def log_message(self, format: str, *args: Any) -> None:
        LOG.debug("[%s] %s", self.server.zone, format % args)

    def _headers(self, status: int, content_type: str, length: int | None = None) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Access-Control-Allow-Origin", "*")  # Demo en red local
        self.send_header("X-Content-Type-Options", "nosniff")
        if length is not None:
            self.send_header("Content-Length", str(length))
        self.end_headers()

    def _json(self, status: int, payload: dict[str, Any]) -> None:
        content = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self._headers(status, "application/json; charset=utf-8", len(content))
        self.wfile.write(content)

    def do_GET(self) -> None:
        route = urlparse(self.path).path
        camera = self.server.facade.cameras[self.server.zone]
        if route == "/health":
            self._json(200, camera.health())
        elif route == "/ocr-status":
            # No expone placa para evitar divulgar informacion al navegador.
            self._json(200, {
                "zona": self.server.zone,
                "estado": self.server.facade.coordinator.status()[self.server.zone],
            })
        elif route == "/snapshot.jpg":
            jpeg = camera.snapshot()
            if jpeg is None:
                self._json(503, {"online": False, "error": "Camara sin fotograma"})
            else:
                self._headers(200, "image/jpeg", len(jpeg))
                self.wfile.write(jpeg)
        elif route == "/video":
            if not camera.is_online():
                self._json(503, {"online": False, "error": "Camara sin fotograma"})
                return
            self._headers(200, "multipart/x-mixed-replace; boundary=frame")
            previous = -1
            try:
                while not self.server.facade.stopped.is_set():
                    seq, jpeg = camera.wait_for_jpeg(previous, timeout=2)
                    if jpeg is None:
                        break
                    if seq == previous:
                        continue
                    previous = seq
                    self.wfile.write(
                        b"--frame\r\nContent-Type: image/jpeg\r\nContent-Length: "
                        + str(len(jpeg)).encode("ascii") + b"\r\n\r\n"
                    )
                    self.wfile.write(jpeg + b"\r\n")
                    self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError, TimeoutError, OSError):
                pass
        else:
            self._json(404, {"error": "Ruta desconocida"})

    def do_POST(self) -> None:
        if urlparse(self.path).path != "/trigger":
            self._json(404, {"error": "Ruta desconocida"})
            return
        facade = self.server.facade
        if not facade.trigger_key:
            self._json(503, {"error": "Configura CAMERA_TRIGGER_KEY antes de activar el IR"})
            return
        token = self.headers.get("x-trigger-key", "")
        if not secrets.compare_digest(token, facade.trigger_key):
            self._json(401, {"error": "Token IR incorrecto"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not (0 < length <= 1024):
                raise ValueError("JSON debe tener entre 1 y 1024 bytes")
            body = json.loads(self.rfile.read(length))
            if not isinstance(body, dict) or body.get("zona") != self.server.zone:
                raise ValueError(f"Se requiere zona={self.server.zone}")
        except (ValueError, json.JSONDecodeError):
            self._json(400, {"error": "Cuerpo incorrecto; envia {\"zona\":\"ENTRADA|SALIDA\"}"})
            return
        accepted, message = facade.coordinator.trigger(self.server.zone)
        self._json(202 if accepted else 409, {"aceptado": accepted, "mensaje": message})


class ParkingCameraFacade:
    """FACHADA: una sola instancia controla la entrada y la salida."""

    def __init__(
        self,
        configs: list[CameraConfig],
        reader: PlateReader,
        backend: NestBackendAdapter,
        rois: dict[str, tuple[float, float, float, float]],
        trigger_key: str | None = None,
    ):
        if len(configs) != 2 or {c.zone for c in configs} != {"ENTRADA", "SALIDA"}:
            raise ValueError("Se requieren exactamente ENTRADA y SALIDA")
        if len({c.index for c in configs}) != 2:
            raise ValueError("Las dos camaras deben tener indices diferentes")
        if len({c.port for c in configs}) != 2:
            raise ValueError("Las dos camaras deben tener puertos diferentes")
        self.cameras = {config.zone: CameraDevice(config) for config in configs}
        self.coordinator = TriggeredOcrCoordinator(self.cameras, reader, backend, rois)
        self.trigger_key = trigger_key
        self.stopped = threading.Event()
        self._servers: list[CameraHttpServer] = []
        self._threads: list[threading.Thread] = []

    def start(self) -> None:
        # Reservar puertos antes de abrir cámaras: error claro si están ocupados.
        try:
            for zone in ("ENTRADA", "SALIDA"):
                self._servers.append(CameraHttpServer(self, zone))
        except Exception:
            for server in self._servers:
                server.server_close()
            raise
        for camera in self.cameras.values():
            camera.start()
        self.coordinator.start()
        for server in self._servers:
            worker = threading.Thread(
                target=server.serve_forever, name=f"http-{server.zone}", daemon=True
            )
            self._threads.append(worker)
            worker.start()
            LOG.info("[%s] http://127.0.0.1:%d/video /snapshot.jpg /health /trigger",
                     server.zone, self.cameras[server.zone].config.port)
        LOG.info("Un proceso para 2 camaras; streaming continuo, OCR solo con evento IR")
        LOG.warning("Solo usar en Wi-Fi privada. Video sin login, no publicar puertos.")

    def stop(self) -> None:
        if self.stopped.is_set():
            return
        self.stopped.set()
        for server in self._servers:
            server.shutdown()
            server.server_close()
        for camera in self.cameras.values():
            camera.stop()
        self.coordinator.stop()
        LOG.info("Camaras y servidores detenidos")

    def run_forever(self) -> None:
        self.start()
        try:
            while not self.stopped.wait(.5):
                pass
        except KeyboardInterrupt:
            pass
        finally:
            self.stop()


def normalized_roi(value: str) -> tuple[float, float, float, float]:
    try:
        numbers = tuple(float(part.strip()) for part in value.split(","))
    except ValueError as exc:
        raise argparse.ArgumentTypeError("ROI debe ser x1,y1,x2,y2 entre 0 y 1") from exc
    if len(numbers) != 4:
        raise argparse.ArgumentTypeError("ROI debe contener 4 numeros")
    x1, y1, x2, y2 = numbers
    if not (0 <= x1 < x2 <= 1 and 0 <= y1 < y2 <= 1):
        raise argparse.ArgumentTypeError("ROI debe cumplir 0<=x1<x2<=1 y 0<=y1<y2<=1")
    return (x1, y1, x2, y2)


def positive_int(value: str) -> int:
    integer = int(value)
    if integer <= 0:
        raise argparse.ArgumentTypeError("El valor debe ser positivo")
    return integer


def main() -> None:
    parser = argparse.ArgumentParser(description="Parking OS: 2 webcams + fachada + OCR por IR")
    parser.add_argument("--entrada", type=int, default=1, help="Indice USB en entrada")
    parser.add_argument("--salida", type=int, default=2, help="Indice USB en salida")
    parser.add_argument("--backend", choices=("dshow", "msmf"), default="dshow")
    parser.add_argument("--fps", type=positive_int, default=20)
    parser.add_argument("--quality", type=int, default=70)
    parser.add_argument("--roi-entrada", type=normalized_roi, default=(0., 0., 1., 1.))
    parser.add_argument("--roi-salida", type=normalized_roi, default=(0., 0., 1., 1.))
    parser.add_argument("--api-url", default=os.getenv("CAMERA_API_URL"))
    parser.add_argument("--demo-close-on-exit", action="store_true",
                        help="Solo demo sin pago: cerrar visita al detectar salida")
    args = parser.parse_args()
    if not 20 <= args.quality <= 95:
        parser.error("quality debe estar entre 20 y 95")

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    executable = os.getenv("TESSERACT_CMD")
    if not executable and os.name == "nt":
        candidate = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
        if os.path.isfile(candidate):
            executable = candidate

    camera_configs = [
        CameraConfig(zone="ENTRADA", index=args.entrada, port=8765,
                     backend=args.backend, fps=args.fps, quality=args.quality),
        CameraConfig(zone="SALIDA", index=args.salida, port=8766,
                     backend=args.backend, fps=args.fps, quality=args.quality),
    ]
    facade = ParkingCameraFacade(
        configs=camera_configs,
        reader=TesseractPlateReader(executable),
        backend=NestBackendAdapter(
            args.api_url, os.getenv("CAMERA_API_KEY"), args.demo_close_on_exit
        ),
        rois={"ENTRADA": args.roi_entrada, "SALIDA": args.roi_salida},
        trigger_key=os.getenv("CAMERA_TRIGGER_KEY"),
    )
    facade.run_forever()


if __name__ == "__main__":
    main()
