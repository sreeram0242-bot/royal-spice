const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding RK Mess...');

  const existingRestaurant = await prisma.restaurant.findUnique({
    where: { adminUsername: 'admin' }
  });
  
  if (existingRestaurant) {
    console.log('✅ Seeding already completed. Skipping.');
    return;
  }

  // Create admin password hash
  const adminHash = await bcrypt.hash('admin123', 10);
  const sreeHash = await bcrypt.hash('sree', 10);
  const gokulHash = await bcrypt.hash('gokul', 10);

  // Create Restaurant
  const restaurant = await prisma.restaurant.create({
    data: {
      name: 'RK Mess',
      adminUsername: 'admin',
      adminPasswordHash: adminHash,
      address: 'RK Mess, Main Road',
      logo: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=200',
      plan: 'premium',
      paymentStatus: 'paid',
      isActive: true,
      gstPercent: 5,
      totalTables: 20,
    }
  });

  console.log(`✅ Restaurant created: ${restaurant.name} (ID: ${restaurant.id})`);

  // Create Waiters
  const waiter1 = await prisma.waiter.create({
    data: {
      restaurantId: restaurant.id,
      name: 'Sree',
      username: 'sree',
      passwordHash: sreeHash,
      isActive: true,
    }
  });

  const waiter2 = await prisma.waiter.create({
    data: {
      restaurantId: restaurant.id,
      name: 'Gokul',
      username: 'gokul',
      passwordHash: gokulHash,
      isActive: true,
    }
  });

  console.log(`✅ Waiter created: ${waiter1.name} (username: sree)`);
  console.log(`✅ Waiter created: ${waiter2.name} (username: gokul)`);

  // Menu Items
  const menuItems = [
    // ---- BREAKFAST ----
    {
      name: 'Idli (2 pcs)',
      description: 'Soft steamed rice cakes served with sambar and coconut chutney',
      price: 30,
      category: 'Breakfast',
      isVeg: true,
      isBestSeller: true,
      image: 'https://images.unsplash.com/photo-1589301760014-d929f39ce9b1?w=400'
    },
    {
      name: 'Masala Dosa',
      description: 'Crispy rice crepe stuffed with spiced potato filling, served with chutney & sambar',
      price: 60,
      category: 'Breakfast',
      isVeg: true,
      isBestSeller: true,
      image: 'https://images.unsplash.com/photo-1630383249896-424e482df921?w=400'
    },
    {
      name: 'Plain Dosa',
      description: 'Crispy golden rice and lentil crepe served with chutney and sambar',
      price: 40,
      category: 'Breakfast',
      isVeg: true,
      isBestSeller: false,
      image: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400'
    },
    {
      name: 'Pongal',
      description: 'Comforting rice and lentil porridge seasoned with ghee, pepper and cumin',
      price: 40,
      category: 'Breakfast',
      isVeg: true,
      isBestSeller: false,
      image: 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=400'
    },
    {
      name: 'Medu Vada',
      description: 'Crispy deep fried lentil donuts served with chutney and sambar',
      price: 30,
      category: 'Breakfast',
      isVeg: true,
      isBestSeller: false,
      image: 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=400'
    },
    {
      name: 'Upma',
      description: 'Savory semolina porridge cooked with vegetables and spices',
      price: 35,
      category: 'Breakfast',
      isVeg: true,
      isBestSeller: false,
      image: 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=400'
    },
    {
      name: 'Poori (2 pcs)',
      description: 'Deep fried fluffy wheat bread served with potato masala',
      price: 45,
      category: 'Breakfast',
      isVeg: true,
      isBestSeller: true,
      image: 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=400'
    },

    // ---- RICE ----
    {
      name: 'Veg Meals',
      description: 'Full South Indian meals with rice, dal, sambar, rasam, papad, pickle and dessert',
      price: 100,
      category: 'Rice',
      isVeg: true,
      isBestSeller: true,
      image: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400'
    },
    {
      name: 'Veg Biryani',
      description: 'Fragrant basmati rice cooked with mixed vegetables and whole spices',
      price: 130,
      category: 'Rice',
      isVeg: true,
      isBestSeller: true,
      image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400'
    },
    {
      name: 'Chicken Biryani',
      description: 'Aromatic basmati rice layered with tender chicken, saffron and fried onions',
      price: 180,
      category: 'Rice',
      isVeg: false,
      isBestSeller: true,
      image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400'
    },
    {
      name: 'Egg Fried Rice',
      description: 'Wok-tossed rice with scrambled egg, spring onions and soy sauce',
      price: 100,
      category: 'Rice',
      isVeg: false,
      isBestSeller: false,
      image: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=400'
    },
    {
      name: 'Curd Rice',
      description: 'Cooked rice mixed with yogurt, tempered with mustard seeds and curry leaves',
      price: 60,
      category: 'Rice',
      isVeg: true,
      isBestSeller: false,
      image: 'https://images.unsplash.com/photo-1645177628172-a94c1f96e6db?w=400'
    },
    {
      name: 'Lemon Rice',
      description: 'Tangy rice tempered with mustard, peanuts, turmeric and lemon juice',
      price: 70,
      category: 'Rice',
      isVeg: true,
      isBestSeller: false,
      image: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=400'
    },

    // ---- CURRIES ----
    {
      name: 'Dal Tadka',
      description: 'Yellow lentils tempered with ghee, cumin, garlic and dried red chilies',
      price: 90,
      category: 'Curries',
      isVeg: true,
      isBestSeller: false,
      image: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400'
    },
    {
      name: 'Paneer Butter Masala',
      description: 'Creamy tomato based gravy with soft paneer cubes and aromatic spices',
      price: 150,
      category: 'Curries',
      isVeg: true,
      isBestSeller: true,
      image: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=400'
    },
    {
      name: 'Egg Curry',
      description: 'Hard-boiled eggs simmered in a spicy onion-tomato gravy',
      price: 100,
      category: 'Curries',
      isVeg: false,
      isBestSeller: true,
      image: 'https://images.unsplash.com/photo-1546548970-71785318a17b?w=400'
    },
    {
      name: 'Chicken Curry',
      description: 'Tender chicken pieces cooked in a rich, spiced onion-tomato gravy',
      price: 160,
      category: 'Curries',
      isVeg: false,
      isBestSeller: true,
      image: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=400'
    },
    {
      name: 'Mixed Veg Curry',
      description: 'Seasonal vegetables cooked in a flavorful spiced gravy',
      price: 100,
      category: 'Curries',
      isVeg: true,
      isBestSeller: false,
      image: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400'
    },

    // ---- BREADS ----
    {
      name: 'Chapati (2 pcs)',
      description: 'Soft whole wheat flatbread made fresh on the tawa',
      price: 20,
      category: 'Breads',
      isVeg: true,
      isBestSeller: false,
      image: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400'
    },
    {
      name: 'Butter Naan',
      description: 'Soft leavened flatbread baked in tandoor and brushed with butter',
      price: 50,
      category: 'Breads',
      isVeg: true,
      isBestSeller: true,
      image: 'https://images.unsplash.com/photo-1606502973842-f64bc2784849?w=400'
    },
    {
      name: 'Parotta (2 pcs)',
      description: 'Flaky layered South Indian flatbread, crispy outside and soft inside',
      price: 40,
      category: 'Breads',
      isVeg: true,
      isBestSeller: true,
      image: 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=400'
    },

    // ---- SNACKS ----
    {
      name: 'Samosa (2 pcs)',
      description: 'Crispy triangular pastry stuffed with spiced potato and peas filling',
      price: 30,
      category: 'Snacks',
      isVeg: true,
      isBestSeller: true,
      image: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400'
    },
    {
      name: 'Onion Bajji',
      description: 'Crispy deep fried onion fritters coated in spiced chickpea batter',
      price: 40,
      category: 'Snacks',
      isVeg: true,
      isBestSeller: false,
      image: 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=400'
    },
    {
      name: 'Masala Egg (2 pcs)',
      description: 'Boiled eggs coated in a spicy masala and shallow fried to perfection',
      price: 50,
      category: 'Snacks',
      isVeg: false,
      isBestSeller: false,
      image: 'https://images.unsplash.com/photo-1506354666786-959d6d497f1a?w=400'
    },
    {
      name: 'French Fries',
      description: 'Golden crispy potato fries served with ketchup',
      price: 60,
      category: 'Snacks',
      isVeg: true,
      isBestSeller: false,
      image: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400'
    },

    // ---- BEVERAGES ----
    {
      name: 'Filter Coffee',
      description: 'Strong South Indian filter coffee with frothy milk served in traditional tumbler',
      price: 20,
      category: 'Beverages',
      isVeg: true,
      isBestSeller: true,
      image: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=400'
    },
    {
      name: 'Masala Chai',
      description: 'Aromatic Indian tea brewed with ginger, cardamom, and spices',
      price: 15,
      category: 'Beverages',
      isVeg: true,
      isBestSeller: true,
      image: 'https://images.unsplash.com/photo-1572119865084-43c285814d63?w=400'
    },
    {
      name: 'Mango Lassi',
      description: 'Thick and sweet chilled yogurt drink blended with fresh mango pulp',
      price: 60,
      category: 'Beverages',
      isVeg: true,
      isBestSeller: false,
      image: 'https://images.unsplash.com/photo-1553361371-9b22f78e8b1d?w=400'
    },
    {
      name: 'Sweet Lassi',
      description: 'Chilled and refreshing yogurt drink sweetened with sugar',
      price: 50,
      category: 'Beverages',
      isVeg: true,
      isBestSeller: false,
      image: 'https://images.unsplash.com/photo-1553361371-9b22f78e8b1d?w=400'
    },
    {
      name: 'Fresh Lime Soda',
      description: 'Refreshing lime juice with soda water, served sweet or salted',
      price: 40,
      category: 'Beverages',
      isVeg: true,
      isBestSeller: false,
      image: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400'
    },
    {
      name: 'Buttermilk',
      description: 'Chilled salted buttermilk with curry leaves and ginger — a South Indian classic',
      price: 20,
      category: 'Beverages',
      isVeg: true,
      isBestSeller: true,
      image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400'
    },

    // ---- DESSERTS ----
    {
      name: 'Gulab Jamun (2 pcs)',
      description: 'Soft milk-solid balls soaked in rose-flavored sugar syrup',
      price: 50,
      category: 'Desserts',
      isVeg: true,
      isBestSeller: true,
      image: 'https://images.unsplash.com/photo-1593504049359-74330189a345?w=400'
    },
    {
      name: 'Kheer',
      description: 'Creamy rice pudding slow-cooked in milk with cardamom, saffron and dry fruits',
      price: 60,
      category: 'Desserts',
      isVeg: true,
      isBestSeller: false,
      image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400'
    },
    {
      name: 'Halwa',
      description: 'Rich semolina pudding cooked in ghee with sugar and garnished with cashews',
      price: 50,
      category: 'Desserts',
      isVeg: true,
      isBestSeller: false,
      image: 'https://images.unsplash.com/photo-1571167421672-9f7eaa2f1e4d?w=400'
    },
    {
      name: 'Ice Cream (2 scoops)',
      description: 'Creamy vanilla and chocolate ice cream served with chocolate sauce',
      price: 70,
      category: 'Desserts',
      isVeg: true,
      isBestSeller: true,
      image: 'https://images.unsplash.com/photo-1560008581-09826d1de69e?w=400'
    },
  ];

  let count = 0;
  for (const item of menuItems) {
    await prisma.menuItem.create({
      data: { ...item, restaurantId: restaurant.id }
    });
    count++;
  }

  console.log(`✅ Created ${count} menu items`);
  console.log('\n🎉 Seeding complete!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🏨 Restaurant : RK Mess`);
  console.log(`🆔 Restaurant ID : ${restaurant.id}`);
  console.log(`👤 Admin Login   : admin / admin123`);
  console.log(`👨 Waiter 1      : sree / sree`);
  console.log(`👨 Waiter 2      : gokul / gokul`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main()
  .catch(e => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
