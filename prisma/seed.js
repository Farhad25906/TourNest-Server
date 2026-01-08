// prisma/seed.js
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const DEFAULT_SUBSCRIPTION_PLANS = [
  {
    name: "Free",
    description: "Perfect for new hosts starting out",
    price: 0,
    duration: 12,
    tourLimit: 4,
    blogLimit: 5,
    features: [
      "Create up to 4 tours per year",
      "Create up to 5 blog posts",
      "Basic profile listing",
      "Customer support",
    ],
    isActive: true,
  },
  {
    name: "Standard",
    description: "For growing hosts who want more exposure",
    price: 9.99,
    duration: 12,
    tourLimit: 12,
    blogLimit: 25,
    features: [
      "Create up to 12 tours per year",
      "Create up to 25 blog posts",
      "Featured in search results",
      "Priority customer support",
      "Analytics dashboard",
    ],
    isActive: true,
  },
  {
    name: "Premium",
    description: "For professional hosts seeking maximum exposure",
    price: 19.99,
    duration: 12,
    tourLimit: 50,
    blogLimit: null,
    features: [
      "Create up to 50 tours per year",
      "Create unlimited blog posts",
      "Top placement in search results",
      "24/7 priority support",
      "Advanced analytics",
      "Marketing tools",
      "Custom branding",
    ],
    isActive: true,
  },
];

async function main() {
  console.log('🌱 Seeding subscription plans...');
  
  for (const planData of DEFAULT_SUBSCRIPTION_PLANS) {
    const existingPlan = await prisma.subscriptionPlan.findFirst({
      where: { name: planData.name }
    });

    if (!existingPlan) {
      await prisma.subscriptionPlan.create({
        data: planData
      });
      console.log(`✅ Created plan: ${planData.name}`);
    } else {
      console.log(`⚠️ Plan already exists: ${planData.name}`);
    }
  }

  console.log('✅ Seeding completed!');
}

main()
  .catch((error) => {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });