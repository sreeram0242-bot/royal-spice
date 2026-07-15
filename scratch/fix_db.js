const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    await prisma.$executeRawUnsafe('ALTER TABLE "KotPrinter" SET (schema_locked = false);');
    console.log("Unlocked KotPrinter");
  } catch (e) {
    console.error("Error unlocking KotPrinter:", e.message);
  }
}

main().finally(() => prisma.$disconnect());
