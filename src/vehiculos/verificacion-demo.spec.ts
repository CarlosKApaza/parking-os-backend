import { describe,it,expect } from 'vitest';
import { verificacionDemo } from './verificacion-demo.js';
describe('habilitación de matrículas de feria',()=>{
  it('requiere configuración explícita',()=>{
    expect(verificacionDemo({})).toBe(false);
    expect(verificacionDemo({VEHICULOS_VERIFICACION_AUTOMATICA:'0'})).toBe(false);
    expect(verificacionDemo({NODE_ENV:'development',VEHICULOS_VERIFICACION_AUTOMATICA:'1'})).toBe(true);
  });
  it('no habilita la opción en producción',()=>{
    expect(verificacionDemo({NODE_ENV:'production',VEHICULOS_VERIFICACION_AUTOMATICA:'1'})).toBe(false);
  });
});
