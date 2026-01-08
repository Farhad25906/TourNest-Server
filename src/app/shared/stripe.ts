import Stripe from "stripe";
import envVars from "../config/env";


// Initialize Stripe with the secret key from environment variables
export const stripe = new Stripe(envVars.STRIPE_SECRET_KEY, {
  typescript: true,
});

// Helper function to create a Stripe customer
export const createStripeCustomer = async (email: string, name?: string, metadata?: any) => {
  try {
    const customer = await stripe.customers.create({
      email,
      name,
      metadata: {
        ...metadata,
        createdVia: "tourist-hub-api",
      },
    });
    return customer;
  } catch (error: any) {
    console.error("Error creating Stripe customer:", error.message);
    throw new Error(`Failed to create Stripe customer: ${error.message}`);
  }
};

// Helper function to create a subscription
export const createStripeSubscription = async (
  customerId: string,
  priceId: string,
  metadata?: Record<string, string>
) => {
  try {
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: "default_incomplete",
      payment_settings: { save_default_payment_method: "on_subscription" },
      expand: ["latest_invoice.payment_intent"],
      metadata,
    });
    return subscription;
  } catch (error: any) {
    console.error("Error creating Stripe subscription:", error.message);
    throw new Error(`Failed to create Stripe subscription: ${error.message}`);
  }
};

// Helper function to create a checkout session
export const createCheckoutSession = async (
  customerId: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string,
  metadata?: Record<string, string>
) => {
  try {
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata,
      subscription_data: {
        metadata,
      },
    });
    return session;
  } catch (error: any) {
    console.error("Error creating checkout session:", error.message);
    throw new Error(`Failed to create checkout session: ${error.message}`);
  }
};

// Helper function to cancel a subscription
export const cancelStripeSubscription = async (subscriptionId: string) => {
  try {
    const cancelledSubscription = await stripe.subscriptions.cancel(subscriptionId);
    return cancelledSubscription;
  } catch (error: any) {
    console.error("Error cancelling Stripe subscription:", error.message);
    throw new Error(`Failed to cancel Stripe subscription: ${error.message}`);
  }
};

// Helper function to retrieve a customer
export const getStripeCustomer = async (customerId: string) => {
  try {
    const customer = await stripe.customers.retrieve(customerId);
    return customer;
  } catch (error: any) {
    console.error("Error retrieving Stripe customer:", error.message);
    throw new Error(`Failed to retrieve Stripe customer: ${error.message}`);
  }
};

// Helper function to create a billing portal session
export const createBillingPortalSession = async (
  customerId: string,
  returnUrl: string
) => {
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
    return session;
  } catch (error: any) {
    console.error("Error creating billing portal session:", error.message);
    throw new Error(`Failed to create billing portal session: ${error.message}`);
  }
};

// Verify webhook signature
export const verifyWebhookSignature = (payload: string, signature: string, secret: string) => {
  try {
    const event = stripe.webhooks.constructEvent(payload, signature, secret);
    return event;
  } catch (error: any) {
    console.error("Webhook signature verification failed:", error.message);
    throw new Error(`Invalid webhook signature: ${error.message}`);
  }
};

// Retrieve subscription
export const getStripeSubscription = async (subscriptionId: string) => {
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    return subscription;
  } catch (error: any) {
    console.error("Error retrieving Stripe subscription:", error.message);
    throw new Error(`Failed to retrieve Stripe subscription: ${error.message}`);
  }
};

// Update subscription
export const updateStripeSubscription = async (subscriptionId: string, updates: any) => {
  try {
    const subscription = await stripe.subscriptions.update(subscriptionId, updates);
    return subscription;
  } catch (error: any) {
    console.error("Error updating Stripe subscription:", error.message);
    throw new Error(`Failed to update Stripe subscription: ${error.message}`);
  }
};

export default {
  stripe,
  createStripeCustomer,
  createStripeSubscription,
  createCheckoutSession,
  cancelStripeSubscription,
  getStripeCustomer,
  createBillingPortalSession,
  verifyWebhookSignature,
  getStripeSubscription,
  updateStripeSubscription,
};