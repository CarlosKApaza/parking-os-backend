import { describe, expect, it } from 'vitest';
import { origenLectura } from './sensores.controller.js';

describe('Autorizacion de lecturas', () => {
  const clave = 'a'.repeat(32);
  it('identifica el hardware', () => expect(origenLectura(clave, clave, false)).toBe('SENSOR_IR'));
  it('rechaza claves incorrectas incluso en modo simulacion', () => expect(() => origenLectura('incorrecta', clave, true)).toThrow());
  it('rechaza peticiones anonimas por defecto', () => expect(() => origenLectura(undefined, clave, false)).toThrow());
  it('permite simulacion solo cuando se habilita', () => expect(origenLectura(undefined, clave, true)).toBe('SIMULACION'));
  it('rechaza una clave sin configurar', () => expect(() => origenLectura('', undefined, false)).toThrow());
});
