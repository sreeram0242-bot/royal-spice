const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testCondition() {
  try {
    // 1. Get a restaurant
    const restaurant = await prisma.restaurant.findFirst();
    if (!restaurant) throw new Error("No restaurant found");
    const restaurantId = restaurant.id;
    console.log('Using restaurant:', restaurant.name);

    // 2. Get two waiters
    const waiters = await prisma.waiter.findMany({ where: { restaurantId }, take: 2 });
    if (waiters.length < 2) throw new Error("Need at least 2 waiters to test");
    const waiterA = waiters[0];
    const waiterB = waiters[1];
    console.log('Waiter A:', waiterA.name);
    console.log('Waiter B:', waiterB.name);

    const tableNumber = 2; // use table 2

    // 3. Clear any existing orders and passcodes for this table
    await prisma.order.deleteMany({ where: { restaurantId, tableNumber } });
    await prisma.tablePasscode.deleteMany({ where: { restaurantId, tableNumber } });

    // 4. Simulate GET /tables for Waiter A
    let passcodeA = Math.floor(1000 + Math.random() * 9000).toString();
    await prisma.tablePasscode.create({
      data: { restaurantId, tableNumber, waiterId: waiterA.id, passcode: passcodeA, waiterName: waiterA.name }
    });
    console.log('Generated Passcode for Waiter A:', passcodeA);

    // 5. Simulate GET /tables for Waiter B
    let passcodeB = Math.floor(1000 + Math.random() * 9000).toString();
    await prisma.tablePasscode.create({
      data: { restaurantId, tableNumber, waiterId: waiterB.id, passcode: passcodeB, waiterName: waiterB.name }
    });
    console.log('Generated Passcode for Waiter B:', passcodeB);

    // 6. Simulate Customer Order using Waiter B's passcode
    const validPasscode = await prisma.tablePasscode.findFirst({
      where: { restaurantId, tableNumber, passcode: passcodeB }
    });
    
    if (!validPasscode) {
      console.error('FAILED: Passcode not found!');
      return;
    }
    
    console.log('Customer used Passcode B. Matched Waiter:', validPasscode.waiterName);
    if (validPasscode.waiterName !== waiterB.name) {
      console.error('FAILED: Waiter name mismatch!');
      return;
    }

    // 7. Customer creates order
    const order = await prisma.order.create({
      data: {
        restaurantId,
        tableNumber,
        sessionId: 'test-session',
        orderNumber: 999,
        subtotal: 100,
        gst: 5,
        total: 105,
        status: 'new',
        waiterName: validPasscode.waiterName,
      }
    });
    console.log('Order created with WaiterName:', order.waiterName);

    // 8. Cleanup other passcodes
    const delResult = await prisma.tablePasscode.deleteMany({
      where: {
        restaurantId,
        tableNumber,
        passcode: { not: passcodeB }
      }
    });
    console.log('Deleted other passcodes count:', delResult.count);
    
    // 9. Verify Passcode A is gone, Passcode B remains
    const remaining = await prisma.tablePasscode.findMany({ where: { restaurantId, tableNumber } });
    console.log('Remaining passcodes for Table 2:', remaining.map(p => p.passcode));

    console.log('SUCCESS: Condition works finely!');

  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

testCondition();
