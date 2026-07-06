const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function create4FakeOrders() {
  const restaurant = await prisma.restaurant.findFirst({
    where: { name: { contains: 'rk mess', mode: 'insensitive' } },
    include: { menuItems: true }
  });

  if (!restaurant) {
    console.log('rk mess not found');
    return;
  }

  let menuItem = null;
  if (restaurant.menuItems.length > 0) {
    menuItem = restaurant.menuItems[0];
  }

  if (!menuItem) {
    console.log('No menu items found for rk mess');
    return;
  }

  for (let i = 1; i <= 4; i++) {
    const tableNumber = (i % 5) + 1;
    const sessionId = 'session-' + Date.now() + '-' + i;
    
    const order = await prisma.order.create({
      data: {
        restaurantId: restaurant.id,
        tableNumber,
        sessionId,
        orderNumber: i,
        subtotal: menuItem.price * 2,
        gst: (menuItem.price * 2) * 0.08,
        total: (menuItem.price * 2) * 1.08,
        status: 'served',
        items: {
          create: [
            {
              menuItemId: menuItem.id,
              name: menuItem.name,
              price: menuItem.price,
              qty: 2
            }
          ]
        }
      }
    });
    console.log(`Fake Order ${i} created for Table ${tableNumber}:`, order.id);
  }
}

create4FakeOrders().catch(console.error).finally(() => prisma.$disconnect());
