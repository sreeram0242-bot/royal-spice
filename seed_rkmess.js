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
      orderConfirmationMode: 'WAITER_PASSCODE'
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

  // Category Settings
  const categorySettings = [
    { categoryName: 'Breakfast', image: '/customer/images/cat_breakfast.png' },
    { categoryName: 'Rice', image: '/customer/images/cat_rice.png' },
    { categoryName: 'Curries', image: '/customer/images/cat_gravies.png' },
    { categoryName: 'Breads', image: '/customer/images/cat_breads.png' },
    { categoryName: 'Snacks', image: '/customer/images/cat_snacks.png' },
    { categoryName: 'Beverages', image: '/customer/images/cat_beverages.png' },
    { categoryName: 'Desserts', image: '/customer/images/cat_desserts.png' }
  ];

  for (const cat of categorySettings) {
    await prisma.categorySetting.create({
      data: {
        restaurantId: restaurant.id,
        categoryName: cat.categoryName,
        image: cat.image
      }
    });
  }
  console.log(`✅ Created ${categorySettings.length} category settings`);

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
      image: '/customer/images/items/idli.png'
    },
    {
      name: 'Masala Dosa',
      description: 'Crispy rice crepe stuffed with spiced potato filling, served with chutney & sambar',
      price: 60,
      category: 'Breakfast',
      isVeg: true,
      isBestSeller: true,
      image: '/customer/images/items/dosa.png'
    },
    {
      name: 'Plain Dosa',
      description: 'Crispy golden rice and lentil crepe served with chutney and sambar',
      price: 40,
      category: 'Breakfast',
      isVeg: true,
      isBestSeller: false,
      image: '/customer/images/items/dosa.png'
    },
    {
      name: 'Pongal',
      description: 'Comforting rice and lentil porridge seasoned with ghee, pepper and cumin',
      price: 40,
      category: 'Breakfast',
      isVeg: true,
      isBestSeller: false,
      image: '/customer/images/items/pongal.png'
    },
    {
      name: 'Medu Vada',
      description: 'Crispy deep fried lentil donuts served with chutney and sambar',
      price: 30,
      category: 'Breakfast',
      isVeg: true,
      isBestSeller: false,
      image: '/customer/images/items/vada.png'
    },
    {
      name: 'Upma',
      description: 'Savory semolina porridge cooked with vegetables and spices',
      price: 35,
      category: 'Breakfast',
      isVeg: true,
      isBestSeller: false,
      image: '/customer/images/items/upma.png'
    },
    {
      name: 'Poori (2 pcs)',
      description: 'Deep fried fluffy wheat bread served with potato masala',
      price: 45,
      category: 'Breakfast',
      isVeg: true,
      isBestSeller: true,
      image: '/customer/images/items/poori.png'
    },

    // ---- RICE ----
    {
      name: 'Veg Meals',
      description: 'Full South Indian meals with rice, dal, sambar, rasam, papad, pickle and dessert',
      price: 100,
      category: 'Rice',
      isVeg: true,
      isBestSeller: true,
      image: '/customer/images/items/meals.png'
    },
    {
      name: 'Veg Biryani',
      description: 'Fragrant basmati rice cooked with mixed vegetables, herbs and whole spices',
      price: 90,
      category: 'Rice',
      isVeg: true,
      isBestSeller: false,
      image: '/customer/images/items/mbiryani.png'
    },
    {
      name: 'Chicken Biryani',
      description: 'Classic spiced biryani made with tender chicken pieces, basmati rice and aromatics',
      price: 140,
      category: 'Rice',
      isVeg: false,
      isBestSeller: true,
      image: '/customer/images/items/cbiryani.png'
    },
    {
      name: 'Egg Fried Rice',
      description: 'Stir-fried rice tossed with eggs, spring onions and savory sauces',
      price: 80,
      category: 'Rice',
      isVeg: false,
      isBestSeller: false,
      image: '/customer/images/items/eggfriedrice.png'
    },
    {
      name: 'Curd Rice',
      description: 'Cooling seasoned yogurt rice with mustard seeds, curry leaves and green chilies',
      price: 50,
      category: 'Rice',
      isVeg: true,
      isBestSeller: false,
      image: '/customer/images/items/curdrice.png'
    },
    {
      name: 'Lemon Rice',
      description: 'Tangy lemon-flavored rice tempered with mustard, peanuts and curry leaves',
      price: 50,
      category: 'Rice',
      isVeg: true,
      isBestSeller: false,
      image: '/customer/images/items/lemonrice.png'
    },

    // ---- CURRIES ----
    {
      name: 'Dal Tadka',
      description: 'Yellow lentils tempered with ghee, cumin, garlic and dry red chilies',
      price: 60,
      category: 'Curries',
      isVeg: true,
      isBestSeller: false,
      image: '/customer/images/items/daltadka.png'
    },
    {
      name: 'Paneer Butter Masala',
      description: 'Soft cottage cheese cubes simmered in a rich tomato and butter gravy',
      price: 90,
      category: 'Curries',
      isVeg: true,
      isBestSeller: true,
      image: '/customer/images/items/paneer.png'
    },
    {
      name: 'Egg Curry',
      description: 'Boiled eggs cooked in a flavorful spiced onion and tomato gravy',
      price: 70,
      category: 'Curries',
      isVeg: false,
      isBestSeller: false,
      image: '/customer/images/items/eggcurry.png'
    },
    {
      name: 'Chicken Curry',
      description: 'Home-style chicken curry cooked with traditional South Indian spices',
      price: 110,
      category: 'Curries',
      isVeg: false,
      isBestSeller: true,
      image: '/customer/images/items/chickencurry.png'
    },
    {
      name: 'Mixed Veg Curry',
      description: 'Garden fresh vegetables cooked in a mildly spiced onion-tomato gravy',
      price: 65,
      category: 'Curries',
      isVeg: true,
      isBestSeller: false,
      image: '/customer/images/items/vegcurry.png'
    },

    // ---- BREADS ----
    {
      name: 'Chapati (2 pcs)',
      description: 'Soft, whole wheat flatbreads cooked on a griddle',
      price: 30,
      category: 'Breads',
      isVeg: true,
      isBestSeller: false,
      image: '/customer/images/items/chapati.png'
    },
    {
      name: 'Butter Naan',
      description: 'Tandoor-baked leavened flatbread brushed generously with butter',
      price: 35,
      category: 'Breads',
      isVeg: true,
      isBestSeller: true,
      image: '/customer/images/items/naan.png'
    },
    {
      name: 'Parotta (2 pcs)',
      description: 'Flaky, layered South Indian flatbread made with refined flour and oil',
      price: 40,
      category: 'Breads',
      isVeg: true,
      isBestSeller: true,
      image: '/customer/images/items/parotta.png'
    },

    // ---- SNACKS ----
    {
      name: 'Samosa (2 pcs)',
      description: 'Crisp pastry triangles stuffed with spiced potatoes and peas',
      price: 30,
      category: 'Snacks',
      isVeg: true,
      isBestSeller: true,
      image: '/customer/images/items/samosa.png'
    },
    {
      name: 'Onion Bajji',
      description: 'Crispy gram-flour battered onion fritters served hot with mint chutney',
      price: 35,
      category: 'Snacks',
      isVeg: true,
      isBestSeller: false,
      image: '/customer/images/items/bajji.png'
    },
    {
      name: 'Masala Egg (2 pcs)',
      description: 'Hard boiled eggs pan-fried with spicy pepper, onion and tomato masala',
      price: 40,
      category: 'Snacks',
      isVeg: false,
      isBestSeller: false,
      image: '/customer/images/items/masalaegg.png'
    },
    {
      name: 'French Fries',
      description: 'Deep-fried salted potato fingers served with tomato ketchup',
      price: 50,
      category: 'Snacks',
      isVeg: true,
      isBestSeller: false,
      image: '/customer/images/items/fries.png'
    },

    // ---- BEVERAGES ----
    {
      name: 'Filter Coffee',
      description: 'Authentic South Indian chicory-blend coffee brewed with hot frothy milk',
      price: 25,
      category: 'Beverages',
      isVeg: true,
      isBestSeller: true,
      image: '/customer/images/items/coffee.png'
    },
    {
      name: 'Masala Chai',
      description: 'Strong milk tea infused with crushed ginger, cardamom and cloves',
      price: 20,
      category: 'Beverages',
      isVeg: true,
      isBestSeller: true,
      image: '/customer/images/items/chai.png'
    },
    {
      name: 'Mango Lassi',
      description: 'Thick, creamy yogurt drink blended with sweet Alphonso mango pulp',
      price: 50,
      category: 'Beverages',
      isVeg: true,
      isBestSeller: false,
      image: '/customer/images/items/mangolassi.png'
    },
    {
      name: 'Sweet Lassi',
      description: 'Traditional Punjabi sweet beaten yogurt drink topped with malai',
      price: 40,
      category: 'Beverages',
      isVeg: true,
      isBestSeller: false,
      image: '/customer/images/items/sweetlassi.png'
    },
    {
      name: 'Fresh Lime Soda',
      description: 'Refreshing fizzy soda with fresh lime juice, mint and choice of sweet or salt',
      price: 35,
      category: 'Beverages',
      isVeg: true,
      isBestSeller: false,
      image: '/customer/images/items/limesoda.png'
    },
    {
      name: 'Buttermilk',
      description: 'Light, spiced churned yogurt drink with ginger, green chilies and coriander',
      price: 25,
      category: 'Beverages',
      isVeg: true,
      isBestSeller: false,
      image: '/customer/images/items/buttermilk.png'
    },

    // ---- DESSERTS ----
    {
      name: 'Gulab Jamun (2 pcs)',
      description: 'Soft fried milk-solid dumplings soaked in rose and cardamom sugar syrup',
      price: 35,
      category: 'Desserts',
      isVeg: true,
      isBestSeller: true,
      image: '/customer/images/items/jamun.png'
    },
    {
      name: 'Kheer',
      description: 'Slow-cooked fragrant rice pudding flavored with saffron, cardamom and nuts',
      price: 45,
      category: 'Desserts',
      isVeg: true,
      isBestSeller: false,
      image: '/customer/images/items/kheer.png'
    },
    {
      name: 'Halwa',
      description: 'Rich semolina and ghee halwa garnished with roasted cashews and raisins',
      price: 40,
      category: 'Desserts',
      isVeg: true,
      isBestSeller: false,
      image: '/customer/images/items/halwa.png'
    },
    {
      name: 'Ice Cream (2 scoops)',
      description: 'Choice of vanilla, chocolate or butterscotch ice cream scoops',
      price: 50,
      category: 'Desserts',
      isVeg: true,
      isBestSeller: true,
      image: '/customer/images/items/icecream.png'
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
