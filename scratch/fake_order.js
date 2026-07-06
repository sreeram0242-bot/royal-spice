const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createFakeOrder() {
  const restaurantId = 'cmqz7hr5f0000e50ij793tpvu';
  const tableNumber = 1;
  const sessionId = 'session-' + Date.now();
  
  const order = await prisma.order.create({
    data: {
      restaurantId,
      tableNumber,
      sessionId,
      orderNumber: 1,
      subtotal: 60,
      gst: 4.8,
      total: 64.8, // Assuming 8% GST
      status: 'served',
      items: {
        create: [
          {
            menuItemId: 'cmqz7kxh30001t9tq78hckdpy',
            name: 'Idli (2 pcs)',
            price: 30,
            qty: 2
          }
        ]
      }
    }
  });
  console.log('Fake Order created for Table 1:', order.id);
}
createFakeOrder().catch(console.error).finally(() => prisma.$disconnect());
