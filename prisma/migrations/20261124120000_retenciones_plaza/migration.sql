CREATE TABLE `retenciones_plaza` (
  `estacionamientoId` INTEGER NOT NULL,
  `usuarioId` INTEGER NOT NULL,
  `token` VARCHAR(64) NOT NULL,
  `venceEn` DATETIME(3) NOT NULL,
  UNIQUE INDEX `retenciones_plaza_token_key`(`token`),
  INDEX `retenciones_plaza_usuarioId_idx`(`usuarioId`),
  INDEX `retenciones_plaza_venceEn_idx`(`venceEn`),
  PRIMARY KEY (`estacionamientoId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE `retenciones_plaza` ADD CONSTRAINT `retenciones_plaza_estacionamientoId_fkey` FOREIGN KEY (`estacionamientoId`) REFERENCES `estacionamientos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `retenciones_plaza` ADD CONSTRAINT `retenciones_plaza_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
