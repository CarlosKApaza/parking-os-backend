-- CreateTable
CREATE TABLE `eventos_estacionamiento` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `estacionamientoId` INTEGER NOT NULL,
    `estadoAnterior` ENUM('DESCONOCIDO', 'LIBRE', 'OCUPADO') NOT NULL,
    `estadoNuevo` ENUM('DESCONOCIDO', 'LIBRE', 'OCUPADO') NOT NULL,
    `origen` ENUM('SENSOR_IR', 'SIMULACION', 'ADMINISTRADOR') NOT NULL DEFAULT 'SENSOR_IR',
    `fechaEvento` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `eventos_estacionamiento_estacionamientoId_fechaEvento_idx`(`estacionamientoId`, `fechaEvento`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `eventos_estacionamiento` ADD CONSTRAINT `eventos_estacionamiento_estacionamientoId_fkey` FOREIGN KEY (`estacionamientoId`) REFERENCES `estacionamientos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
