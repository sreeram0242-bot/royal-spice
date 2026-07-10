const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`DROP TABLE "TablePasscode" CASCADE;`);
  console.log('Dropped');
}

main().catch(console.error).finally(() => prisma.$disconnect());
