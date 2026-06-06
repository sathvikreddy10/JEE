import { prisma } from './src/lib/db.ts';
prisma.$connect()
  .then(() => console.log('OK'))
  .catch(e => console.error('ERR', e.message))
  .finally(() => prisma.$disconnect());
