const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('admin123', 10);
  await prisma.restaurant.update({
    where: { id: 'cmqz7hr5f0000e50ij793tpvu' },
    data: { adminPasswordHash: hash }
  });
  console.log('Password reset successfully');
}

main().finally(() => prisma.$disconnect());
