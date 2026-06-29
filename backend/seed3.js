const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10);

  for (let i = 1; i <= 3; i++) {
    const hotelName = `Hotel Grand ${i}`;
    const adminUsername = `admin_grand${i}`;

    const restaurant = await prisma.restaurant.create({
      data: {
        name: hotelName,
        adminUsername: adminUsername,
        adminPasswordHash: passwordHash,
        address: `10${i} Grand Street`,
        logo: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=200',
        plan: 'premium',
        paymentStatus: 'paid',
        isActive: true
      }
    });

    console.log(`Created ${hotelName}`);

    const menuItems = [
      {
        name: 'Butter Naan',
        description: 'Soft and buttery flatbread',
        price: 50,
        category: 'Breads',
        isVeg: true,
        isBestSeller: true,
        image: 'https://images.unsplash.com/photo-1606502973842-f64bc2784849?w=400'
      },
      {
        name: 'Paneer Butter Masala',
        description: 'Rich and creamy paneer gravy',
        price: 250,
        category: 'Gravies',
        isVeg: true,
        isBestSeller: true,
        image: 'https://images.unsplash.com/photo-1589301760014-d929f39ce9b1?w=400'
      },
      {
        name: 'Mango Lassi',
        description: 'Sweet and thick mango yogurt drink',
        price: 120,
        category: 'Beverages',
        isVeg: true,
        isBestSeller: false,
        image: 'https://images.unsplash.com/photo-1536935338788-846bb9981813?w=400'
      },
      {
        name: 'Gulab Jamun',
        description: 'Deep fried milk dough balls in sugar syrup',
        price: 80,
        category: 'Desserts',
        isVeg: true,
        isBestSeller: true,
        image: 'https://images.unsplash.com/photo-1593504049359-74330189a345?w=400'
      }
    ];

    for (const item of menuItems) {
      await prisma.menuItem.create({
        data: {
          ...item,
          restaurantId: restaurant.id
        }
      });
    }

    console.log(`Added menu items for ${hotelName}`);
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
