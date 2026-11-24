import { BadRequestException } from '@nestjs/common';

export function objectBody(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BadRequestException('Se requiere un objeto JSON.');
  return value as Record<string, unknown>;
}
export function requiredText(value: unknown, field: string, max: number, min = 1): string {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) throw new BadRequestException(field + ' no válido.');
  return value.trim();
}
export function optionalText(value: unknown, field: string, max: number): string | null {
  if (value === null || value === undefined || value === '') return null;
  return requiredText(value, field, max);
}
export function email(value: unknown): string {
  const normalized = requiredText(value, 'Correo', 150).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new BadRequestException('Correo no válido.');
  return normalized;
}
export function password(value: unknown, registration = false): string {
  if (typeof value !== 'string' || value.length < (registration ? 8 : 1) || value.length > 128) throw new BadRequestException(registration ? 'La contraseña debe tener entre 8 y 128 caracteres.' : 'Contraseña no válida.');
  return value;
}
