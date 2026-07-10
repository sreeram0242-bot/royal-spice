const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`DELETE FROM "TablePasscode";`);
  console.log('Deleted');
}

main().catch(console.error).finally(() => prisma.$disconnect());
