/*
  Warnings:

  - A unique constraint covering the columns `[sensorCodigo]` on the table `estacionamientos` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `estacionamientos` ADD COLUMN `activo` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `sensorCodigo` VARCHAR(191) NULL,
    ADD COLUMN `ultimaLectura` DATETIME(3) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `estacionamientos_sensorCodigo_key` ON `estacionamientos`(`sensorCodigo`);
