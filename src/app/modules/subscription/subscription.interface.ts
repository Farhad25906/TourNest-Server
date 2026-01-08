export type CreateSubscriptionPlanInput = {
  name: string;
  description: string;
  price: number;
  duration: number;
  tourLimit: number;
  canWriteBlogs: boolean;
  blogPostLimit?: number | null;
  features: string[];
  isActive?: boolean;
  stripePriceId?: string;
  stripeProductId?: string;
};

export type UpdateSubscriptionPlanInput = {
  name?: string;
  description?: string;
  price?: number;
  duration?: number;
  tourLimit?: number;
  canWriteBlogs?: boolean;
  blogPostLimit?: number | null;
  features?: string[];
  isActive?: boolean;
  stripePriceId?: string;
  stripeProductId?: string;
};

export type CreateSubscriptionInput = {
  planId: string;
  autoRenew?: boolean;
};

export type ProcessPaymentInput = {
  subscriptionId: string;
  paymentMethod: 'STRIPE' | 'BKASH' | 'NAGAD' | 'BANK';
  cardNumber?: string;
  cardExpMonth?: number;
  cardExpYear?: number;
  cardCvc?: string;
  phoneNumber?: string;
};

export type SubscriptionResponse = {
  id: string;
  hostId: string;
  planId: string;
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
  startDate: Date;
  endDate: Date;
  status: string;
  autoRenew: boolean;
  tourLimit: number;
  remainingTours: number;
  blogPostsAllowed: boolean;
  blogPostLimit?: number | null;
  remainingBlogPosts?: number | null;
  createdAt: Date;
  updatedAt: Date;
  plan: {
    id: string;
    name: string;
    description: string;
    price: number;
    duration: number;
    features: string[];
  };
};

export type CheckoutSessionResponse = {
  checkoutUrl: string;
  sessionId: string;
  subscriptionId: string;
  message: string;
};