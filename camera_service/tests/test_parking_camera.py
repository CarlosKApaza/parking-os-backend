"""Pruebas de la fachada sin webcams, ni OpenCV, ni MySQL."""
import argparse
import threading
import time
import unittest
from unittest.mock import Mock

from camera_service.parking_camera import (
    CameraConfig,
    CameraDevice,
    NestBackendAdapter,
    ParkingCameraFacade,
    TriggeredOcrCoordinator,
    normalized_roi,
)


class FakeReader:
    def __init__(self, plate="1234ABC"):
        self.plate = plate

    def read(self, frame, roi):
        return self.plate


class StubCamera:
    def __init__(self, online=True):
        self.online = online
        self.counter = 0

    def is_online(self):
        return self.online

    def frame_for_ocr(self):
        self.counter += 1
        return self.counter, object()


class CameraTests(unittest.TestCase):
    def test_rois(self):
        self.assertEqual(normalized_roi("0.1,0.2,0.9,0.8"), (.1, .2, .9, .8))
        for value in ("0,0,2,1", "0.3,0.1,0.2,0.8", "a,b,c,d", "0,0,1"):
            with self.subTest(value=value):
                with self.assertRaises(argparse.ArgumentTypeError):
                    normalized_roi(value)

    def test_config_requires_distinct_cameras(self):
        with self.assertRaisesRegex(ValueError, "indices diferentes"):
            ParkingCameraFacade(
                [CameraConfig("ENTRADA", 1, 8765), CameraConfig("SALIDA", 1, 8766)],
                FakeReader(), NestBackendAdapter(None, None, False),
                {"ENTRADA": (0, 0, 1, 1), "SALIDA": (0, 0, 1, 1)},
            )

    def test_camera_without_frames_is_offline(self):
        cam = CameraDevice(CameraConfig("ENTRADA", 1, 8765))
        self.assertFalse(cam.is_online())
        self.assertIsNone(cam.snapshot())
        self.assertFalse(cam.health()["online"])

    def test_backend_exit_does_not_close_visit_without_payment(self):
        reporter = NestBackendAdapter("http://localhost:3000/camaras/lecturas", "secret", False)
        result = reporter.report("SALIDA", "1234ABC", 3)
        self.assertIn("NO cerrada", result)

    def test_backend_optional(self):
        reporter = NestBackendAdapter(None, None, False)
        self.assertIn("localmente", reporter.report("ENTRADA", "1234ABC", 3))

    def test_ir_rejects_offline_camera(self):
        coordinator = TriggeredOcrCoordinator(
            {"ENTRADA": StubCamera(False)}, FakeReader(),
            NestBackendAdapter(None, None, False), {"ENTRADA": (0, 0, 1, 1)},
        )
        ok, reason = coordinator.trigger("ENTRADA")
        self.assertFalse(ok)
        self.assertIn("sin video", reason)

    def test_three_matching_reads_after_ir(self):
        camera = StubCamera()
        coordinator = TriggeredOcrCoordinator(
            {"ENTRADA": camera},
            FakeReader("1234ABC"),
            NestBackendAdapter(None, None, False),
            {"ENTRADA": (0, 0, 1, 1)},
        )
        coordinator.start()
        try:
            accepted, _ = coordinator.trigger("ENTRADA")
            self.assertTrue(accepted)
            again, message = coordinator.trigger("ENTRADA")
            self.assertFalse(again)
            self.assertIn("curso", message)
            deadline = time.monotonic() + 2
            while time.monotonic() < deadline:
                if coordinator.status()["ENTRADA"] == "placa confirmada":
                    break
                time.sleep(.05)
            self.assertEqual(coordinator.status()["ENTRADA"], "placa confirmada")
            self.assertGreaterEqual(camera.counter, 3)
            ok, reason = coordinator.trigger("ENTRADA")
            self.assertFalse(ok)
            self.assertIn("Cooldown", reason)
        finally:
            coordinator.stop()


if __name__ == "__main__":
    unittest.main()
