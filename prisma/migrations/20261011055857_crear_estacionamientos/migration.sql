-- CreateTable
CREATE TABLE `estacionamientos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `codigo` VARCHAR(191) NOT NULL,
    `estado` ENUM('DESCONOCIDO', 'LIBRE', 'OCUPADO') NOT NULL DEFAULT 'DESCONOCIDO',
    `fechaCreacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fechaCambio` DATETIME(3) NOT NULL,

    UNIQUE INDEX `estacionamientos_codigo_key`(`codigo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
