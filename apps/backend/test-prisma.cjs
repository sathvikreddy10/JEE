const {PrismaClient} = require('@prisma/client');
const p = new PrismaClient();
p.$connect()
  .then(() => console.log('OK'))
  .catch(e => console.error('ERR', e.message))
  .finally(() => p.$disconnect());
