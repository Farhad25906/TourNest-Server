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

export const subscriptionSearchableFields = [
  "status",
  "host.name",
  "host.email",
];

export const subscriptionFilterableFields = [
  "searchTerm",
  "status",
  "hostId",
  "planId",
  "hostName",
  "hostEmail",
];
export const SUBSCRIPTION_PAYMENT_STATUS = {
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
} as const;

export const SUBSCRIPTION_PAYMENT_METHOD = {
  STRIPE: "STRIPE",
  BKASH: "BKASH",
  NAGAD: "NAGAD",
  BANK: "BANK",
} as const;

export const subscriptionPaymentSuccessUrl = (sessionId: string) =>
  `${process.env.FRONTEND_URL}/buy-subscription/payment/success?session_id=${sessionId}`;

export const subscriptionPaymentCancelUrl = (subscriptionId: string) =>
  `${process.env.FRONTEND_URL}/subscription/payment/cancel?subscription_id=${subscriptionId}`;
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
      "Featured in search results",
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
      "Featured in search results",
      "Priority customer support",
      "Analytics dashboard",
    ],
    isActive: true,
  },
];
