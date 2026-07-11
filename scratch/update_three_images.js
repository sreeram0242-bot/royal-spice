const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const rest = await prisma.restaurant.findFirst({
    where: {
      name: { contains: 'Rk', mode: 'insensitive' }
    }
  });

  if (!rest) {
      console.log('Restaurant not found');
      return;
  }

  const updates = {
    'Pongal': 'images/items/pongal.png',
    'Paneer Butter Masala': 'images/items/paneer.png',
    'Masala Chai': 'images/items/chai.png'
  };

  const items = await prisma.menuItem.findMany({
      where: { restaurantId: rest.id }
  });

  let count = 0;
  for (const item of items) {
      if (updates[item.name]) {
          await prisma.menuItem.update({
              where: { id: item.id },
              data: { image: updates[item.name] }
          });
          count++;
          console.log(`Updated ${item.name} to ${updates[item.name]}`);
      }
  }
  console.log(`Updated ${count} items.`);
}

main().finally(() => prisma.$disconnect());
