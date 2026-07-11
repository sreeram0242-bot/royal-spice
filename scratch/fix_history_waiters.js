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

  const waiters = await prisma.waiter.findMany({
      where: { restaurantId: rest.id }
  });

  if (waiters.length === 0) {
      console.log('No waiters found for this restaurant');
      return;
  }

  const waiterNames = waiters.map(w => w.name);
  console.log('Waiters:', waiterNames);

  const orders = await prisma.order.findMany({
      where: { restaurantId: rest.id }
  });

  let updated = 0;
  for (const order of orders) {
      // If waiterName is missing, or it says Admin but there are actual waiters
      if (!order.waiterName || order.waiterName === 'Admin') {
          const randomWaiter = waiterNames[Math.floor(Math.random() * waiterNames.length)];
          await prisma.order.update({
              where: { id: order.id },
              data: { waiterName: randomWaiter }
          });
          updated++;
      }
  }

  console.log(`Updated ${updated} orders with random waiter names.`);
}

main().finally(() => prisma.$disconnect());
