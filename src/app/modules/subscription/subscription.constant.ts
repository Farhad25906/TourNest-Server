// subscription.constant.ts
export const subscriptionPlanSearchableFields = ["name", "description"];

export const subscriptionPlanFilterableFields = [
  "searchTerm",
  "name",
  "minPrice",
  "maxPrice",
  "isActive",
  "tourLimit",
  "blogLimit",
];

export const subscriptionSearchableFields = ["status", "host.name", "host.email"];

export const subscriptionFilterableFields = [
  "searchTerm",
  "status",
  "hostId",
  "planId",
  "hostName",
  "hostEmail",
];

// These will be seeded to database
export const DEFAULT_SUBSCRIPTION_PLANS = [
  {
    name: "Free",
    description: "Perfect for new hosts starting out",
    price: 0,
    duration: 12,
    tourLimit: 4,
    blogLimit: 5, // 5 blogs limit
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
    blogLimit: 25, // 25 blogs limit
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
    blogLimit: null, // Unlimited blogs (null means unlimited)
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