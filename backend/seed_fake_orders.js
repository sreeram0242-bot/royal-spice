const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Find RK Mess
  const restaurant = await prisma.restaurant.findFirst({
    where: { name: { contains: 'RK Mess', mode: 'insensitive' } }
  });

  if (!restaurant) {
    console.error('Restaurant RK Mess not found!');
    return;
  }

  console.log(`Found restaurant: ${restaurant.name} (ID: ${restaurant.id})`);

  // Fetch some menu items for this restaurant
  const menuItems = await prisma.menuItem.findMany({
    where: { restaurantId: restaurant.id }
  });

  if (menuItems.length === 0) {
    console.error('No menu items found for this restaurant. Please add some first.');
    return;
  }

  console.log(`Found ${menuItems.length} menu items.`);

  const now = new Date();
  let ordersCreated = 0;
  let totalRevenueAdded = 0;

  for (let i = 0; i < 30; i++) {
    // Random date within the last 2 days (48 hours)
    const randomHoursAgo = Math.random() * 48;
    const orderDate = new Date(now.getTime() - randomHoursAgo * 60 * 60 * 1000);
    
    // Pick 1-3 random menu items
    const numItems = Math.floor(Math.random() * 3) + 1;
    const items = [];
    let subtotal = 0;
    
    for (let j = 0; j < numItems; j++) {
      const randomItem = menuItems[Math.floor(Math.random() * menuItems.length)];
      const qty = Math.floor(Math.random() * 3) + 1;
      items.push({
        menuItemId: randomItem.id,
        name: randomItem.name,
        price: randomItem.price,
        qty: qty
      });
      subtotal += randomItem.price * qty;
    }
    
    const gst = subtotal * (restaurant.gstPercent / 100);
    const total = subtotal + gst;
    
    // Generate order number and session ID
    const orderNumber = Math.floor(Math.random() * 10000) + 1000;
    const sessionId = 'fake-session-' + Date.now() + '-' + i;
    
    const order = await prisma.order.create({
      data: {
        restaurantId: restaurant.id,
        tableNumber: Math.floor(Math.random() * 10) + 1,
        orderNumber: orderNumber,
        subtotal: subtotal,
        gst: gst,
        tip: 0,
        total: total,
        status: 'completed',
        sessionId: sessionId,
        sessionNumber: orderNumber,
        paymentMethod: Math.random() > 0.5 ? 'cash' : 'upi',
        closedByWaiter: Math.random() > 0.5 ? 'Admin' : 'Ravi Waiter',
        createdAt: orderDate,
        items: {
          create: items
        }
      }
    });
    
    ordersCreated++;
    totalRevenueAdded += total;
  }

  console.log(`Successfully generated ${ordersCreated} fake orders.`);
  console.log(`Total Revenue added: ₹${totalRevenueAdded.toFixed(2)}`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
