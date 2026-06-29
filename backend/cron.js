const cron = require('node-cron');
const prisma = require('./db');

module.exports = (io) => {
  // Run every day at midnight
  cron.schedule('0 0 * * *', async () => {
    console.log('Running daily cron job for subscription checks...');
    try {
      const restaurants = await prisma.restaurant.findMany({
        where: { isActive: true, plan: 'trial' }
      });
      
      const today = new Date();
      
      for (const rest of restaurants) {
        if (!rest.subscriptionExpiry) continue;
        
        const expiryDate = new Date(rest.subscriptionExpiry);
        const timeDiff = expiryDate.getTime() - today.getTime();
        const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
        
        if (daysDiff <= 0) {
          // Expired
          await prisma.restaurant.update({
            where: { id: rest.id },
            data: { isActive: false, paymentStatus: 'unpaid' }
          });
          
          const notif = await prisma.masterNotification.create({
            data: {
              restaurantId: rest.id,
              message: 'Your trial has expired and your service is suspended. Please upgrade your plan.'
            }
          });
          
          if (io) io.to(rest.id).emit('master_notification', { message: notif.message, date: notif.createdAt });
          
        } else if (daysDiff === 7 || daysDiff === 3 || daysDiff === 1) {
          // Reminder
          const notif = await prisma.masterNotification.create({
            data: {
              restaurantId: rest.id,
              message: `Reminder: Your trial expires in ${daysDiff} day(s). Please upgrade to avoid service interruption.`
            }
          });
          
          if (io) io.to(rest.id).emit('master_notification', { message: notif.message, date: notif.createdAt });
        }
      }
    } catch (err) {
      console.error('Error in daily cron job:', err);
    }
  });
};
