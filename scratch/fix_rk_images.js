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
    'Medu Vada': 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=400',
    'Pongal': 'https://images.unsplash.com/photo-1631452180519-c014fe946bc0?w=400',
    'Poori Sabji (2 pcs)': 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=400',
    'Egg Fried Rice': 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=400',
    'Gobi 65': 'https://images.unsplash.com/photo-1559847844-5315695dadae?w=400',
    'Egg Bonda': 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400',
    'Chilli Parotta': 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=400',
    'Chapathi (2 pcs)': 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400',
    'Chicken Chettinad': 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=400',
    'Paneer Butter Masala': 'https://images.unsplash.com/photo-1589301760014-d929f39ce9b1?w=400',
    'Mutton Curry': 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400',
    'Masala Chai': 'https://images.unsplash.com/photo-1577968897966-3d413341ed89?w=400',
    'Fresh Lime Soda': 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=400',
    'Payasam': 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=400'
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
          console.log(`Updated ${item.name}`);
      }
  }
  console.log(`Updated ${count} items.`);
}

main().finally(() => prisma.$disconnect());
