-- Fase 1: ampliacion aditiva, conserva plazas, historial y visitas de prueba.
-- Las visitas existentes y el endpoint OCR anterior conservan estado LEGADO.

CREATE TABLE `usuarios` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(100) NOT NULL,
    `correo` VARCHAR(150) NOT NULL,
    `passwordHash` VARCHAR(255) NOT NULL,
    `telefono` VARCHAR(20) NULL,
    `rol` ENUM('CLIENTE', 'ADMINISTRADOR') NOT NULL DEFAULT 'CLIENTE',
    `activo` BOOLEAN NOT NULL DEFAULT TRUE,
    `fechaRegistro` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `usuarios_correo_key`(`correo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `vehiculos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `usuarioId` INTEGER NOT NULL,
    `placa` VARCHAR(12) NOT NULL,
    `marca` VARCHAR(50) NULL,
    `modelo` VARCHAR(50) NULL,
    `color` VARCHAR(30) NULL,
    `estadoVerificacion` ENUM('PENDIENTE', 'VERIFICADO', 'RECHAZADO') NOT NULL DEFAULT 'PENDIENTE',
    `activo` BOOLEAN NOT NULL DEFAULT TRUE,
    `fechaRegistro` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `vehiculos_placa_key`(`placa`),
    INDEX `vehiculos_usuarioId_idx`(`usuarioId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `tarifas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `codigo` VARCHAR(32) NOT NULL,
    `nombre` VARCHAR(100) NOT NULL,
    `precioHora` DECIMAL(10,2) NOT NULL,
    `modalidad` ENUM('POR_MINUTO', 'POR_HORA') NOT NULL DEFAULT 'POR_MINUTO',
    `toleranciaSalidaMin` INTEGER NOT NULL DEFAULT 10,
    `vigenteDesde` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `vigenteHasta` DATETIME(3) NULL,
    `activo` BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE INDEX `tarifas_codigo_key`(`codigo`),
    INDEX `tarifas_activo_vigenteDesde_idx`(`activo`, `vigenteDesde`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `camaras` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `codigo` VARCHAR(32) NOT NULL,
    `nombre` VARCHAR(100) NOT NULL,
    `zona` ENUM('ENTRADA', 'SALIDA') NOT NULL,
    `urlVideo` VARCHAR(255) NULL,
    `activa` BOOLEAN NOT NULL DEFAULT TRUE,
    `ultimaConexion` DATETIME(3) NULL,
    UNIQUE INDEX `camaras_codigo_key`(`codigo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `reservas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `codigo` VARCHAR(64) NOT NULL,
    `usuarioId` INTEGER NOT NULL,
    `vehiculoId` INTEGER NOT NULL,
    `estacionamientoId` INTEGER NOT NULL,
    `fechaInicio` DATETIME(3) NOT NULL,
    `fechaFin` DATETIME(3) NOT NULL,
    `estado` ENUM('PENDIENTE', 'CONFIRMADA', 'EN_USO', 'FINALIZADA', 'CANCELADA', 'VENCIDA') NOT NULL DEFAULT 'PENDIENTE',
    `fechaCreacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `reservas_codigo_key`(`codigo`),
    INDEX `reservas_usuarioId_idx`(`usuarioId`),
    INDEX `reservas_vehiculoId_idx`(`vehiculoId`),
    INDEX `reservas_estacionamientoId_fechaInicio_fechaFin_idx`(`estacionamientoId`, `fechaInicio`, `fechaFin`),
    INDEX `reservas_estado_fechaFin_idx`(`estado`, `fechaFin`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `visitas_vehiculos`
    ADD COLUMN `vehiculoId` INTEGER NULL,
    ADD COLUMN `usuarioId` INTEGER NULL,
    ADD COLUMN `reservaId` INTEGER NULL,
    ADD COLUMN `tarifaId` INTEGER NULL,
    ADD COLUMN `precioHoraAplicado` DECIMAL(10,2) NULL,
    ADD COLUMN `modalidadAplicada` ENUM('POR_MINUTO', 'POR_HORA') NULL,
    ADD COLUMN `toleranciaAplicadaMin` INTEGER NULL,
    ADD COLUMN `fechaIngresoConfirmada` DATETIME(3) NULL,
    ADD COLUMN `camaraIngresoId` INTEGER NULL,
    ADD COLUMN `camaraSalidaId` INTEGER NULL,
    ADD COLUMN `estado` ENUM('LEGADO', 'PENDIENTE_INGRESO', 'DENTRO', 'PAGADO', 'SALIDA_AUTORIZADA', 'FINALIZADO', 'CANCELADA') NOT NULL DEFAULT 'LEGADO',
    ADD UNIQUE INDEX `visitas_vehiculos_reservaId_key`(`reservaId`),
    ADD INDEX `visitas_vehiculos_vehiculoId_idx`(`vehiculoId`),
    ADD INDEX `visitas_vehiculos_usuarioId_idx`(`usuarioId`),
    ADD INDEX `visitas_vehiculos_tarifaId_idx`(`tarifaId`),
    ADD INDEX `visitas_vehiculos_camaraIngresoId_idx`(`camaraIngresoId`),
    ADD INDEX `visitas_vehiculos_camaraSalidaId_idx`(`camaraSalidaId`),
    ADD INDEX `visitas_vehiculos_estado_idx`(`estado`);

CREATE TABLE `tickets` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `visitaId` INTEGER NOT NULL,
    `codigo` VARCHAR(64) NOT NULL,
    `tokenAccesoHash` VARCHAR(64) NOT NULL,
    `importeTotal` DECIMAL(10,2) NOT NULL DEFAULT 0,
    `minutosFacturados` INTEGER NOT NULL DEFAULT 0,
    `fechaEmision` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fechaLimiteSalida` DATETIME(3) NULL,
    `estado` ENUM('PENDIENTE', 'PAGADO', 'CERRADO', 'ANULADO') NOT NULL DEFAULT 'PENDIENTE',
    UNIQUE INDEX `tickets_visitaId_key`(`visitaId`),
    UNIQUE INDEX `tickets_codigo_key`(`codigo`),
    UNIQUE INDEX `tickets_tokenAccesoHash_key`(`tokenAccesoHash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `pagos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ticketId` INTEGER NOT NULL,
    `usuarioId` INTEGER NULL,
    `referencia` VARCHAR(64) NOT NULL,
    `importe` DECIMAL(10,2) NOT NULL,
    `metodo` ENUM('QR_SIMULADO', 'BILLETERA') NOT NULL,
    `estado` ENUM('PENDIENTE', 'CONFIRMADO', 'RECHAZADO', 'ANULADO') NOT NULL DEFAULT 'PENDIENTE',
    `simulado` BOOLEAN NOT NULL DEFAULT TRUE,
    `fechaCreacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fechaConfirmacion` DATETIME(3) NULL,
    UNIQUE INDEX `pagos_referencia_key`(`referencia`),
    INDEX `pagos_ticketId_estado_idx`(`ticketId`, `estado`),
    INDEX `pagos_usuarioId_idx`(`usuarioId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `billeteras` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `usuarioId` INTEGER NOT NULL,
    `saldo` DECIMAL(10,2) NOT NULL DEFAULT 0,
    `fechaActualizacion` DATETIME(3) NOT NULL,
    UNIQUE INDEX `billeteras_usuarioId_key`(`usuarioId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `movimientos_billetera` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `billeteraId` INTEGER NOT NULL,
    `pagoId` INTEGER NULL,
    `referencia` VARCHAR(64) NOT NULL,
    `tipo` ENUM('RECARGA', 'PAGO', 'DEVOLUCION') NOT NULL,
    `importe` DECIMAL(10,2) NOT NULL,
    `saldoAnterior` DECIMAL(10,2) NOT NULL,
    `saldoPosterior` DECIMAL(10,2) NOT NULL,
    `fecha` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `movimientos_billetera_pagoId_key`(`pagoId`),
    UNIQUE INDEX `movimientos_billetera_referencia_key`(`referencia`),
    INDEX `movimientos_billetera_billeteraId_fecha_idx`(`billeteraId`, `fecha`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `lecturas_ocr` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `eventoId` VARCHAR(64) NOT NULL,
    `camaraId` INTEGER NOT NULL,
    `visitaId` INTEGER NULL,
    `placa` VARCHAR(12) NOT NULL,
    `confirmaciones` INTEGER NOT NULL,
    `confianza` DECIMAL(5,2) NULL,
    `resultado` ENUM('ACEPTADA', 'DUPLICADA', 'RECHAZADA') NOT NULL,
    `fechaCaptura` DATETIME(3) NOT NULL,
    `fechaRecepcion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `lecturas_ocr_eventoId_key`(`eventoId`),
    INDEX `lecturas_ocr_camaraId_fechaCaptura_idx`(`camaraId`, `fechaCaptura`),
    INDEX `lecturas_ocr_visitaId_idx`(`visitaId`),
    INDEX `lecturas_ocr_placa_fechaCaptura_idx`(`placa`, `fechaCaptura`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `eventos_barrera` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `eventoId` VARCHAR(64) NOT NULL,
    `comandoId` VARCHAR(64) NULL,
    `visitaId` INTEGER NULL,
    `zona` ENUM('ENTRADA', 'SALIDA') NOT NULL,
    `tipoEvento` ENUM('AUTORIZACION', 'APERTURA', 'PASO_CONFIRMADO', 'CIERRE', 'DENEGACION', 'ERROR') NOT NULL,
    `resultado` ENUM('AUTORIZADA', 'ABIERTA', 'PASO_CONFIRMADO', 'CERRADA', 'DENEGADA', 'ERROR') NOT NULL,
    `motivo` VARCHAR(255) NULL,
    `venceEn` DATETIME(3) NULL,
    `fechaEvento` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `eventos_barrera_eventoId_key`(`eventoId`),
    INDEX `eventos_barrera_visitaId_idx`(`visitaId`),
    INDEX `eventos_barrera_comandoId_idx`(`comandoId`),
    INDEX `eventos_barrera_zona_fechaEvento_idx`(`zona`, `fechaEvento`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `vehiculos` ADD CONSTRAINT `vehiculos_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `reservas` ADD CONSTRAINT `reservas_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `reservas` ADD CONSTRAINT `reservas_vehiculoId_fkey` FOREIGN KEY (`vehiculoId`) REFERENCES `vehiculos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `reservas` ADD CONSTRAINT `reservas_estacionamientoId_fkey` FOREIGN KEY (`estacionamientoId`) REFERENCES `estacionamientos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `visitas_vehiculos` ADD CONSTRAINT `visitas_vehiculos_vehiculoId_fkey` FOREIGN KEY (`vehiculoId`) REFERENCES `vehiculos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `visitas_vehiculos` ADD CONSTRAINT `visitas_vehiculos_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `visitas_vehiculos` ADD CONSTRAINT `visitas_vehiculos_reservaId_fkey` FOREIGN KEY (`reservaId`) REFERENCES `reservas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `visitas_vehiculos` ADD CONSTRAINT `visitas_vehiculos_tarifaId_fkey` FOREIGN KEY (`tarifaId`) REFERENCES `tarifas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `visitas_vehiculos` ADD CONSTRAINT `visitas_vehiculos_camaraIngresoId_fkey` FOREIGN KEY (`camaraIngresoId`) REFERENCES `camaras`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `visitas_vehiculos` ADD CONSTRAINT `visitas_vehiculos_camaraSalidaId_fkey` FOREIGN KEY (`camaraSalidaId`) REFERENCES `camaras`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `tickets` ADD CONSTRAINT `tickets_visitaId_fkey` FOREIGN KEY (`visitaId`) REFERENCES `visitas_vehiculos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `pagos` ADD CONSTRAINT `pagos_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `tickets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `pagos` ADD CONSTRAINT `pagos_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `billeteras` ADD CONSTRAINT `billeteras_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `movimientos_billetera` ADD CONSTRAINT `movimientos_billetera_billeteraId_fkey` FOREIGN KEY (`billeteraId`) REFERENCES `billeteras`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `movimientos_billetera` ADD CONSTRAINT `movimientos_billetera_pagoId_fkey` FOREIGN KEY (`pagoId`) REFERENCES `pagos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `lecturas_ocr` ADD CONSTRAINT `lecturas_ocr_camaraId_fkey` FOREIGN KEY (`camaraId`) REFERENCES `camaras`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `lecturas_ocr` ADD CONSTRAINT `lecturas_ocr_visitaId_fkey` FOREIGN KEY (`visitaId`) REFERENCES `visitas_vehiculos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `eventos_barrera` ADD CONSTRAINT `eventos_barrera_visitaId_fkey` FOREIGN KEY (`visitaId`) REFERENCES `visitas_vehiculos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Configuracion inicial de la feria, sin cuentas ni contrasenas predefinidas.
INSERT INTO `tarifas` (`codigo`, `nombre`, `precioHora`, `modalidad`, `toleranciaSalidaMin`) VALUES ('FERIA-BASE', 'Tarifa demo', 15.00, 'POR_MINUTO', 10);
INSERT INTO `camaras` (`codigo`, `nombre`, `zona`) VALUES ('CAM-01', 'UVC Entrada', 'ENTRADA'), ('CAM-02', 'W77 Salida', 'SALIDA');
