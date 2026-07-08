const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    const orders = await prisma.order.findMany();
    console.log('Orders:', orders.length);
    const restaurants = await prisma.restaurant.findMany();
    console.log('Restaurants:', restaurants.length);
    const complaints = await prisma.complaint.findMany();
    console.log('Complaints:', complaints.length);
    
    // Group revenue by restaurant
    const revenueByRest = {};
    restaurants.forEach(r => {
      revenueByRest[r.id] = { id: r.id, name: r.name, totalRevenue: 0, firstOrder: null, plan: r.plan, isActive: r.isActive };
    });
    
    orders.forEach(o => {
      if (revenueByRest[o.restaurantId]) {
        revenueByRest[o.restaurantId].totalRevenue += o.total;
        const oDate = new Date(o.createdAt);
        if (!revenueByRest[o.restaurantId].firstOrder || oDate < revenueByRest[o.restaurantId].firstOrder) {
          revenueByRest[o.restaurantId].firstOrder = oDate;
        }
      }
    });

    const now = new Date();
    const revenueBreakdown = Object.values(revenueByRest).map(r => {
      let days = 1;
      if (r.firstOrder) {
        days = Math.max(1, Math.ceil((now - r.firstOrder) / (1000 * 60 * 60 * 24)));
      }
      return {
        ...r,
        avgDaily: r.totalRevenue / days
      };
    });
    console.log("All OK!");
  } catch(e) {
    console.error('Error:', e);
  } finally {
    process.exit(0);
  }
}

test();
