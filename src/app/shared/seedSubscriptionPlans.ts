// app/utils/seedSubscriptionPlans.ts
import { PrismaClient } from '@prisma/client';
import { DEFAULT_SUBSCRIPTION_PLANS } from '../modules/subscription/subscription.constant';

const prisma = new PrismaClient();

export async function seedSubscriptionPlansOnStartup() {
  try {
    console.log('🌱 Checking database for subscription plans...');
    
    // Check if any subscription plans exist
    const existingPlansCount = await prisma.subscriptionPlan.count();
    
    if (existingPlansCount === 0) {
      console.log('No subscription plans found. Seeding default plans...');
      
      for (const planData of DEFAULT_SUBSCRIPTION_PLANS) {
        await prisma.subscriptionPlan.create({
          data: planData
        });
        console.log(`✅ Created plan: ${planData.name}`);
      }
      
      console.log('✅ Default subscription plans seeded successfully!');
    } else {
      console.log(`✅ Subscription plans already exist (${existingPlansCount} plans found).`);
      
      // Optional: Check and update existing plans to match defaults
      for (const defaultPlan of DEFAULT_SUBSCRIPTION_PLANS) {
        const existingPlan = await prisma.subscriptionPlan.findFirst({
          where: { name: defaultPlan.name }
        });
        
        if (!existingPlan) {
          await prisma.subscriptionPlan.create({
            data: defaultPlan
          });
          console.log(`✅ Created missing plan: ${defaultPlan.name}`);
        }
      }
    }
    
  } catch (error: any) {
    console.error('❌ Error during subscription plan seeding:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// For manual seeding
export async function manualSeedSubscriptionPlans() {
  console.log('🌱 Manual seeding of subscription plans...');
  await seedSubscriptionPlansOnStartup();
  console.log('✅ Manual seeding completed!');
}