-- Registro de ingresos y salidas reconocidos por camaras (OCR).
-- No modifica la tabla estacionamientos ni sus lecturas IR.
CREATE TABLE `visitas_vehiculos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `placa` VARCHAR(12) NOT NULL,
    `placaActiva` VARCHAR(12) NULL,
    `fechaIngreso` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fechaSalida` DATETIME(3) NULL,
    `camaraIngreso` VARCHAR(32) NULL,
    `camaraSalida` VARCHAR(32) NULL,

    UNIQUE INDEX `visitas_vehiculos_placaActiva_key`(`placaActiva`),
    INDEX `visitas_vehiculos_placa_fechaIngreso_idx`(`placa`, `fechaIngreso`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
