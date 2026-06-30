const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const r = await prisma.restaurant.findFirst({
    where: { name: { contains: 'rk mess', mode: 'insensitive' } }
  });
  console.log(r);
}

main().finally(() => prisma.$disconnect());
