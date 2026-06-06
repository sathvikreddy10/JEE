import { PrismaClient } from '@prisma/client';
const p = new PrismaClient({
  datasources: { db: { url: 'file:C:/Users/sathv/Desktop/testify/apps/backend/prisma/dev.db' } }
});
p.$connect()
  .then(() => console.log('OK'))
  .catch(e => console.error('ERR', e.message))
  .finally(() => p.$disconnect());
