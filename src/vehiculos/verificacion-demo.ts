/** Habilitación de prueba, no acredita la propiedad real del vehículo. */
export function verificacionDemo(env: {NODE_ENV?:string;VEHICULOS_VERIFICACION_AUTOMATICA?:string} = process.env): boolean {
  return env.NODE_ENV !== 'production' && env.VEHICULOS_VERIFICACION_AUTOMATICA === '1';
}
