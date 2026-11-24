import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { randomBytes, scrypt } from 'node:crypto';
import { promisify } from 'node:util';

if (process.env.DEMO_SEED !== '1' || process.env.NODE_ENV === 'production') {
  throw new Error('Seeder exclusivo de feria. Define DEMO_SEED=1 en el entorno local.');
}
const db = new PrismaClient();
const demoPassword = 'Parking123*';
const adminPassword = process.env.DEMO_ADMIN_PASSWORD;
if (adminPassword && (adminPassword.length < 12 || adminPassword.length > 128 || adminPassword === demoPassword)) {
  await db.$disconnect();
  throw new Error('DEMO_ADMIN_PASSWORD debe ser distinta y tener 12–128 caracteres.');
}
const derive = promisify(scrypt);
async function hash(password) {
  const salt = randomBytes(16);
  return 'scrypt$' + salt.toString('hex') + '$' + (await derive(password,salt,64)).toString('hex');
}
const clientes = [
  {nombre:'Alex',correo:'alex@parkingos.test',placa:'8520PHD',saldo:150},
  {nombre:'María',correo:'maria@parkingos.test',placa:'1234ABC',saldo:100},
  {nombre:'Daniel',correo:'daniel@parkingos.test',placa:'4567XYZ',saldo:200},
];
try {
  for (const cliente of clientes) {
    const passwordHash = await hash(demoPassword);
    const created = await db.$transaction(async tx => {
      // No sobrescribir cuentas, saldos ni placas existentes al repetir el seed.
      if (await tx.usuario.findUnique({where:{correo:cliente.correo}})) return false;
      if (await tx.vehiculo.findUnique({where:{placa:cliente.placa}})) throw new Error('Placa ya registrada: '+cliente.placa);
      const user = await tx.usuario.create({data:{nombre:cliente.nombre,correo:cliente.correo,passwordHash,rol:'CLIENTE',
        vehiculos:{create:{placa:cliente.placa,estadoVerificacion:'VERIFICADO'}},
        billetera:{create:{saldo:cliente.saldo,movimientos:{create:{referencia:'SEED-'+cliente.placa,tipo:'RECARGA',importe:cliente.saldo,saldoAnterior:0,saldoPosterior:cliente.saldo}}}}
      }});
      return Boolean(user);
    });
    console.log(cliente.correo + (created ? ' creado' : ' existente, sin cambios'));
  }
  if (adminPassword) {
    const correo='admin@parkingos.test';
    if (!await db.usuario.findUnique({where:{correo}})) {
      await db.usuario.create({data:{nombre:'Administrador',correo,passwordHash:await hash(adminPassword),rol:'ADMINISTRADOR'}});
      console.log(correo+' creado');
    } else console.log(correo+' existente, sin cambios');
  }
} finally { await db.$disconnect(); }
