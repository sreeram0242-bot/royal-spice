const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const restaurant = await prisma.restaurant.findFirst({
    where: { name: 'RK MESS' }
  });
  
  if (restaurant) {
    console.log(`Restaurant ID: ${restaurant.id}`);
  } else {
    console.log("RK MESS not found. Finding any restaurant...");
    const anyRest = await prisma.restaurant.findFirst();
    if (anyRest) console.log(`Any Restaurant ID: ${anyRest.id} (${anyRest.name})`);
    else console.log("No restaurants found.");
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
