const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const rest = await prisma.restaurant.findFirst({
    where: {
      name: { contains: 'Rk', mode: 'insensitive' }
    }
  });
  console.log(rest);
  
  if (rest) {
      const items = await prisma.menuItem.findMany({
          where: { restaurantId: rest.id }
      });
      console.log('Total items:', items.length);
      console.log('Items without image or bad image:', items.map(i => ({id: i.id, name: i.name, image: i.image})));
  }
}

main().finally(() => prisma.$disconnect());
