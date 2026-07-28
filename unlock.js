const dns = require('dns');
if (dns.setDefaultResultOrder) dns.setDefaultResultOrder('ipv4first');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tables = ['InventoryItem', 'RecipeIngredient', 'Vendor', 'PurchaseOrder', 'WastageLog', 'StockTransaction', 'StockUsage'];
  for (const table of tables) {
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "${table}" SET (schema_locked = false);`);
      console.log(`Unlocked ${table}`);
    } catch (e) {
      console.error(`Error unlocking ${table}`, e.message);
    }
  }
}

main().finally(() => prisma.$disconnect());
