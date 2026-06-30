const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runTests() {
  console.log("🚀 Starting Edge Case QA Tests...");
  
  try {
    const restaurant = await prisma.restaurant.findFirst();
    if (!restaurant) throw new Error("No restaurant found");
    console.log("Testing for Restaurant:", restaurant.name);
    
    const menuItem = await prisma.menuItem.findFirst({ where: { restaurantId: restaurant.id } });
    if (!menuItem) throw new Error("No menu item found");

    // 1. Customer places initial order
    console.log("\n[Scenario 1] Customer sits at Table 99 and places an order with Tip & Note");
    const res1 = await fetch('http://localhost:5000/api/customer/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurantId: restaurant.id,
        tableNumber: 99,
        items: [{ menuItemId: menuItem.id, name: menuItem.name, price: menuItem.price, qty: 2, specialNote: "EXTRA SPICY PLS" }],
        subtotal: 500,
        gst: 25,
        tip: 50,
        total: 575,
        sessionId: null // Should generate new session and increment sessionCounter
      })
    });
    const data1 = await res1.json();
    console.log("Order 1 Result:", data1.message, "| Session ID:", data1.order.sessionId, "| Session #:", data1.order.sessionNumber);
    const sessionId = data1.order.sessionId;

    // 2. Customer places a SECOND order on the same table (add-on)
    console.log("\n[Scenario 2] Customer orders more items (Add-on) with NO Tip");
    const res2 = await fetch('http://localhost:5000/api/customer/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurantId: restaurant.id,
        tableNumber: 99,
        items: [{ menuItemId: menuItem.id, name: menuItem.name, price: menuItem.price, qty: 1, specialNote: "" }],
        subtotal: menuItem.price,
        gst: menuItem.price * 0.05,
        tip: 0,
        total: menuItem.price * 1.05,
        sessionId: sessionId // Existing session
      })
    });
    const data2 = await res2.json();
    console.log("Order 2 Result:", data2.message, "| Session #:", data2.order.sessionNumber);

    if (data1.order.sessionNumber !== data2.order.sessionNumber) {
      console.error("❌ ERROR: Session numbers do not match for the same table session!");
    } else {
      console.log("✅ Session numbers correctly matched.");
    }

    // 3. Waiter generates the bill
    console.log("\n[Scenario 3] Waiter requests the bill for Table 99");
    
    // We need a waiter token, or we can just query the DB directly to simulate the bill logic
    const orders = await prisma.order.findMany({
      where: { sessionId: sessionId, status: { not: 'completed' } },
      include: { items: true }
    });
    const subtotal = orders.reduce((sum, o) => sum + o.subtotal, 0);
    const totalTip = orders.reduce((sum, o) => sum + (o.tip || 0), 0);
    const grandTotal = orders.reduce((sum, o) => sum + o.total, 0);

    console.log(`Subtotal: ₹${subtotal}`);
    console.log(`Total Tip: ₹${totalTip}`);
    console.log(`Grand Total: ₹${grandTotal}`);
    
    if (totalTip === 50) console.log("✅ Tip was correctly aggregated across orders.");
    else console.error("❌ ERROR: Tip aggregation failed. Expected 50, got", totalTip);

    // 4. Admin marks orders as complete (Close Session)
    console.log("\n[Scenario 4] Admin closes the session");
    await prisma.order.updateMany({
      where: { sessionId: sessionId },
      data: { status: 'completed' }
    });
    console.log("✅ Session closed successfully.");

  } catch (err) {
    console.error("Test execution failed:", err);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
