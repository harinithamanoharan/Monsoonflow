import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();
p.$connect()
  .then(() => console.log('success'))
  .catch((e) => {
    console.error('ERROR OBJECT:', e);
    console.error('ERROR MESSAGE:', e.message);
  });
