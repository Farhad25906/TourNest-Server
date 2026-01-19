import {
  Subscription,
  SubscriptionPlan,
  SubscriptionStatus,
  Prisma,
  PaymentStatus,
  PaymentMethod,
} from "@prisma/client";
import { prisma } from "../../shared/prisma";
import { IOptions, paginationHelper } from "../../helper/paginationHelper";
import {
  subscriptionPlanSearchableFields,
  subscriptionSearchableFields,
  DEFAULT_SUBSCRIPTION_PLANS,
} from "./subscription.constant";
import { IJWTPayload } from "../../types/common";
import { stripe } from "../../config/stripe";
import envVars from "../../config/env";
import ApiError from "../../errors/ApiError";
import { StatusCodes } from "http-status-codes";

// Add these helper functions at the top
const calculateEndDate = (startDate: Date, durationMonths: number): Date => {
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + durationMonths);
  return endDate;
};

const updateHostSubscriptionData = async (
  hostId: string,
  plan: SubscriptionPlan,
  subscriptionId: string,
) => {
  await prisma.host.update({
    where: { id: hostId },
    data: {
      subscriptionId: subscriptionId,
      tourLimit: plan.tourLimit,
      currentTourCount: 0, // Reset tour count for new subscription
    },
  });
};

// Initialize default plans in database
const initializeDefaultPlans = async () => {
  try {
    const existingPlans = await prisma.subscriptionPlan.count();

    if (existingPlans === 0) {
      console.log("🌱 Seeding default subscription plans...");

      for (const plan of DEFAULT_SUBSCRIPTION_PLANS) {
        await prisma.subscriptionPlan.create({
          data: plan,
        });
        console.log(`✅ Created ${plan.name} plan`);
      }

      console.log("✅ Default subscription plans initialized");
      return { success: true, message: "Default plans initialized" };
    }

    // Optional: Check if all default plans exist, create missing ones
    for (const defaultPlan of DEFAULT_SUBSCRIPTION_PLANS) {
      const existingPlan = await prisma.subscriptionPlan.findFirst({
        where: { name: defaultPlan.name },
      });

      if (!existingPlan) {
        await prisma.subscriptionPlan.create({
          data: defaultPlan,
        });
        console.log(`✅ Created missing plan: ${defaultPlan.name}`);
      }
    }

    return { success: true, message: "Plans already exist" };
  } catch (error: any) {
    console.error("❌ Error initializing plans:", error.message);
    throw new Error(`Failed to initialize plans: ${error.message}`);
  }
};

// Create subscription plan (Admin)
const createSubscriptionPlan = async (
  payload: any,
): Promise<SubscriptionPlan> => {
  // Validate blogLimit if provided
  if (payload.blogLimit !== undefined && payload.blogLimit !== null) {
    if (payload.blogLimit < 0) {
      throw new Error("blogLimit must be greater than or equal to 0");
    }
  }

  const result = await prisma.subscriptionPlan.create({
    data: {
      ...payload,
      blogLimit: payload.blogLimit === 0 ? null : payload.blogLimit, // Convert 0 to null for unlimited
    },
  });

  return result;
};

// Get all subscription plans
const getAllSubscriptionPlans = async (params: any, options: IOptions) => {
  const { page, limit, skip, sortBy, sortOrder } =
    paginationHelper.calculatePagination(options);
  const { searchTerm, minPrice, maxPrice, ...filterData } = params;

  const andConditions: Prisma.SubscriptionPlanWhereInput[] = [];

  // Show only active plans by default (for non-admin users)
  if (!filterData.showAll) {
    andConditions.push({
      isActive: true,
    });
  }

  if (searchTerm) {
    andConditions.push({
      OR: subscriptionPlanSearchableFields.map((field) => ({
        [field]: {
          contains: searchTerm,
          mode: "insensitive",
        },
      })),
    });
  }

  // Price range filter
  if (minPrice !== undefined || maxPrice !== undefined) {
    const priceCondition: any = {};
    if (minPrice !== undefined) priceCondition.gte = Number(minPrice);
    if (maxPrice !== undefined) priceCondition.lte = Number(maxPrice);
    andConditions.push({ price: priceCondition });
  }

  // Other filters
  if (Object.keys(filterData).length > 0) {
    andConditions.push({
      AND: Object.keys(filterData).map((key) => ({
        [key]: {
          equals: (filterData as any)[key],
        },
      })),
    });
  }

  const whereConditions: Prisma.SubscriptionPlanWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  const result = await prisma.subscriptionPlan.findMany({
    skip,
    take: limit,
    where: whereConditions,
    orderBy: {
      [sortBy]: sortOrder,
    },
  });

  const total = await prisma.subscriptionPlan.count({
    where: whereConditions,
  });

  return {
    meta: {
      page,
      limit,
      total,
    },
    data: result,
  };
};

const getAllPlans = async () => {
  // Get all subscriptions from Prisma
  const subscriptions = await prisma.subscriptionPlan.findMany({
    where: {
      isActive: true,
    },
    orderBy: {
      price: "asc",
    },
  });

  return subscriptions;
};

// Get single subscription plan
const getSingleSubscriptionPlan = async (id: string) => {
  const result = await prisma.subscriptionPlan.findUnique({
    where: { id },
  });

  if (!result) {
    throw new Error("Subscription plan not found");
  }

  return result;
};

// Update subscription plan (Admin)
const updateSubscriptionPlan = async (
  id: string,
  data: any,
): Promise<SubscriptionPlan> => {
  const plan = await prisma.subscriptionPlan.findUnique({
    where: { id },
  });

  if (!plan) {
    throw new Error("Subscription plan not found");
  }

  // Handle blogLimit conversion
  const updateData = { ...data };
  if (updateData.blogLimit !== undefined) {
    updateData.blogLimit =
      updateData.blogLimit === 0 ? null : updateData.blogLimit;
  }

  const result = await prisma.subscriptionPlan.update({
    where: { id },
    data: updateData,
  });

  // Update existing active subscriptions if tourLimit or blogLimit changed
  if (data.tourLimit !== undefined || data.blogLimit !== undefined) {
    await prisma.subscription.updateMany({
      where: {
        planId: id,
        status: "ACTIVE",
      },
      data: {
        tourLimit:
          data.tourLimit !== undefined ? data.tourLimit : plan.tourLimit,
        remainingTours:
          data.tourLimit !== undefined ? data.tourLimit : undefined,
        blogLimit:
          data.blogLimit !== undefined
            ? data.blogLimit === 0
              ? null
              : data.blogLimit
            : plan.blogLimit,
        remainingBlogs:
          data.blogLimit !== undefined
            ? data.blogLimit === 0
              ? null
              : data.blogLimit
            : undefined,
      },
    });
  }

  return result;
};

// Delete subscription plan (Admin)
const deleteSubscriptionPlan = async (
  id: string,
): Promise<SubscriptionPlan> => {
  const plan = await prisma.subscriptionPlan.findUnique({
    where: { id },
  });

  if (!plan) {
    throw new Error("Subscription plan not found");
  }

  // Check if plan has active subscriptions
  const activeSubscriptions = await prisma.subscription.count({
    where: {
      planId: id,
      status: "ACTIVE",
    },
  });

  if (activeSubscriptions > 0) {
    throw new Error("Cannot delete plan with active subscriptions");
  }

  const result = await prisma.subscriptionPlan.delete({
    where: { id },
  });

  return result;
};

// Initiate subscription payment (similar to booking payment)
const initiateSubscriptionPayment = async (
  subscriptionId: string,
  userEmail: string,
) => {
  const user = await prisma.user.findUnique({
    where: { email: userEmail },
    select: { id: true, email: true },
  });

  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
  }

  // Get subscription details with host
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: {
      plan: true,
      host: {
        include: {
          user: true,
        },
      },
    },
  });

  if (!subscription) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Subscription not found");
  }

  // Check if subscription belongs to user
  if (subscription.host.user.email !== userEmail) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      "You are not authorized to pay for this subscription",
    );
  }

  // Check if subscription is already active
  if (subscription.status === SubscriptionStatus.ACTIVE) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "This subscription is already active",
    );
  }

  // Check if subscription is cancelled or expired
  if (
    subscription.status === SubscriptionStatus.CANCELLED ||
    subscription.status === SubscriptionStatus.EXPIRED
  ) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "This subscription cannot be paid for",
    );
  }

  // Check if plan price is 0 (free plan)
  if (subscription.plan.price === 0) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Free plans don't require payment",
    );
  }

  // Check for existing active payment session
  const existingPayment = await prisma.payment.findFirst({
    where: {
      subscriptionId,
      status: {
        in: [PaymentStatus.PENDING, PaymentStatus.PROCESSING],
      },
    },
  });

  if (existingPayment && existingPayment.stripeSessionId) {
    try {
      const session = await stripe.checkout.sessions.retrieve(
        existingPayment.stripeSessionId,
      );
      if (session.status === "open") {
        return {
          paymentUrl: session.url,
          sessionId: session.id,
          paymentId: existingPayment.id,
        };
      }
    } catch (error) {
      // Session expired, create new one
      console.log("Previous session expired, creating new one");
    }
  }

  // Create payment record for subscription
  const payment = await prisma.payment.create({
    data: {
      userId: user.id,
      subscriptionId,
      amount: subscription.plan.price,
      currency: "USD",
      paymentMethod: PaymentMethod.STRIPE,
      status: PaymentStatus.PENDING,
      description: `Subscription payment for ${subscription.plan.name} plan`,
      metadata: {
        subscriptionId,
        planName: subscription.plan.name,
        duration: subscription.plan.duration,
        planId: subscription.planId,
      },
    },
  });

  // Create Stripe Checkout Session for subscription
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    customer_email: user.email,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `${subscription.plan.name} Subscription Plan`,
            description: subscription.plan.description,
            metadata: {
              plan_id: subscription.planId,
              subscription_id: subscriptionId,
            },
          },
          unit_amount: Math.round(subscription.plan.price * 100), // Convert to cents
        },
        quantity: 1,
      },
    ],
    metadata: {
      subscriptionId,
      userId: user.id,
      paymentId: payment.id,
      planName: subscription.plan.name,
      planDuration: subscription.plan.duration.toString(),
      planPrice: subscription.plan.price.toString(),
      planId: subscription.planId,
    },
    success_url: `${envVars.FRONTEND_URL}/buy-subscription/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${envVars.FRONTEND_URL}/buy-subscription/payment/cancel?subscription_id=${subscriptionId}`,
  });

  // Update payment with session info
  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      stripeSessionId: session.id,
      status: PaymentStatus.PROCESSING,
    },
  });

  return {
    paymentUrl: session.url,
    sessionId: session.id,
    paymentId: payment.id,
  };
};

// Get subscription payment info
const getSubscriptionPaymentInfo = async (
  subscriptionId: string,
  userEmail: string,
) => {
  const user = await prisma.user.findUnique({
    where: { email: userEmail },
  });

  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
  }

  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: {
      plan: true,
      host: {
        include: {
          user: true,
        },
      },
      payments: {
        where: {
          status: {
            in: [
              PaymentStatus.PENDING,
              PaymentStatus.PROCESSING,
              PaymentStatus.COMPLETED,
              PaymentStatus.FAILED,
            ],
          },
        },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!subscription) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Subscription not found");
  }

  if (subscription.host.user.email !== userEmail) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      "You are not authorized to view this subscription",
    );
  }

  const latestPayment = subscription.payments[0];

  // Determine if payment can be initiated
  let canPay = false;
  let requiresPayment = false;

  if (subscription.plan.price > 0) {
    if (subscription.status === SubscriptionStatus.PENDING) {
      canPay = true;
      requiresPayment = true;
    } else if (latestPayment && latestPayment.status === PaymentStatus.FAILED) {
      canPay = true;
      requiresPayment = true;
    }
  }

  const isPaid = subscription.status === SubscriptionStatus.ACTIVE;
  const isFree = subscription.plan.price === 0;

  return {
    subscription,
    payment: latestPayment,
    canPay,
    isPaid,
    isFree,
    requiresPayment,
    subscriptionStatus: subscription.status,
    plan: subscription.plan,
  };
};

// Create subscription (Host)
// const createSubscription = async (user: IJWTPayload, planId: string) => {
//   try {
//     // Find host
//     const host = await prisma.host.findUnique({
//       where: { email: user.email },
//       include: { user: true },
//     });

//     if (!host) {
//       throw new ApiError(StatusCodes.NOT_FOUND, "Host not found");
//     }

//     // Get subscription plan
//     const plan = await prisma.subscriptionPlan.findUnique({
//       where: { id: planId },
//     });

//     if (!plan) {
//       throw new ApiError(StatusCodes.NOT_FOUND, "Subscription plan not found");
//     }

//     if (!plan.isActive) {
//       throw new ApiError(
//         StatusCodes.BAD_REQUEST,
//         "This subscription plan is not available",
//       );
//     }

//     // Check for existing active subscription
//     const existingActiveSubscription = await prisma.subscription.findFirst({
//       where: {
//         hostId: host.id,
//         status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PENDING] },
//       },
//     });

//     if (existingActiveSubscription) {
//       throw new ApiError(
//         StatusCodes.BAD_REQUEST,
//         "You already have an active or pending subscription. Please cancel it first.",
//       );
//     }

//     // Calculate dates
//     const startDate = new Date();
//     const endDate = calculateEndDate(startDate, plan.duration);

//     // Determine initial status based on price
//     const initialStatus =
//       plan.price === 0 ? SubscriptionStatus.ACTIVE : SubscriptionStatus.PENDING;

//     // Create subscription
//     const subscription = await prisma.subscription.create({
//       data: {
//         hostId: host.id,
//         planId: plan.id,
//         startDate,
//         endDate,
//         status: initialStatus,
//         autoRenew: true,
//         tourLimit: plan.tourLimit,
//         remainingTours: plan.tourLimit,
//         blogLimit: plan.blogLimit,
//         remainingBlogs: plan.blogLimit || 0,
//       },
//       include: {
//         plan: true,
//       },
//     });

//     // If free plan, update host immediately
//     if (plan.price === 0) {
//       await updateHostSubscriptionData(host.id, plan, subscription.id);

//       return {
//         success: true,
//         subscription,
//         message: "Free subscription activated successfully",
//         requiresPayment: false,
//       };
//     }
//     console.log(host?.user.id);
//     // For paid plans, create a payment record
//     const payment = await prisma.payment.create({
//       data: {
//         userId: host?.user.id,
//         amount: plan.price,
//         currency: "USD",
//         paymentMethod: PaymentMethod.STRIPE,
//         status: PaymentStatus.PENDING,
//         subscriptionId: subscription.id,
//         description: `Subscription payment for ${plan.name} plan`,
//         metadata: {
//           planId: plan.id,
//           planName: plan.name,
//           duration: plan.duration,
//         },
//       },
//     });

//     return {
//       success: true,
//       subscription,
//       payment,
//       message: "Subscription created successfully. Please complete payment.",
//       requiresPayment: true,
//       paymentId: payment.id,
//       subscriptionId: subscription.id,
//     };
//   } catch (error: any) {
//     console.error("Error creating subscription:", error.message);
//     if (error instanceof ApiError) {
//       throw error;
//     }
//     throw new ApiError(
//       StatusCodes.INTERNAL_SERVER_ERROR,
//       `Failed to create subscription: ${error.message}`,
//     );
//   }
// };

const createSubscription = async (user: IJWTPayload, planId: string) => {
  try {
    // Start transaction with longer timeout
    const result = await prisma.$transaction(
      async (tx) => {
        // Find host
        const host = await tx.host.findUnique({
          where: { email: user.email },
          include: { user: true },
        });

        if (!host) {
          throw new ApiError(StatusCodes.NOT_FOUND, "Host not found");
        }

        // Get subscription plan
        const plan = await tx.subscriptionPlan.findUnique({
          where: { id: planId },
        });

        if (!plan) {
          throw new ApiError(
            StatusCodes.NOT_FOUND,
            "Subscription plan not found",
          );
        }

        if (!plan.isActive) {
          throw new ApiError(
            StatusCodes.BAD_REQUEST,
            "This subscription plan is not available",
          );
        }

        // Check for existing active subscription
        const existingActiveSubscription = await tx.subscription.findFirst({
          where: {
            hostId: host.id,
            status: {
              in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PENDING],
            },
          },
        });

        if (existingActiveSubscription) {
          throw new ApiError(
            StatusCodes.BAD_REQUEST,
            "You already have an active or pending subscription. Please cancel it first.",
          );
        }

        // Calculate dates
        const startDate = new Date();
        const endDate = calculateEndDate(startDate, plan.duration);

        // Determine initial status based on price
        const initialStatus =
          plan.price === 0
            ? SubscriptionStatus.ACTIVE
            : SubscriptionStatus.PENDING;

        // Handle blog limit correctly (null means unlimited)
        const blogLimit = plan.blogLimit === 0 ? null : plan.blogLimit;
        const remainingBlogs = blogLimit || 0;

        // Create subscription
        const subscription = await tx.subscription.create({
          data: {
            hostId: host.id,
            planId: plan.id,
            startDate,
            endDate,
            status: initialStatus,
            autoRenew: true,
            tourLimit: plan.tourLimit,
            remainingTours: plan.tourLimit,
            blogLimit: blogLimit,
            remainingBlogs: remainingBlogs,
          },
          include: {
            plan: true,
          },
        });

        // If free plan, update host immediately and return
        // if (plan.price === 0) {
        //   await tx.host.update({
        //     where: { id: host.id },
        //     data: {
        //       subscriptionId: subscription.id,
        //       tourLimit: plan.tourLimit,
        //       currentTourCount: 0,
        //       blogLimit: blogLimit,
        //       currentBlogCount: 0,
        //     },
        //   });

        //   return {
        //     success: true,
        //     subscription,
        //     message: "Free subscription activated successfully",
        //     requiresPayment: false,
        //   };
        // }

        // For paid plans, create a payment record
        const payment = await tx.payment.create({
          data: {
            userId: host.user.id,
            amount: plan.price,
            currency: "USD",
            paymentMethod: PaymentMethod.STRIPE,
            status: PaymentStatus.PENDING,
            subscriptionId: subscription.id,
            description: `Subscription payment for ${plan.name} plan`,
            metadata: {
              planId: plan.id,
              planName: plan.name,
              duration: plan.duration,
            },
          },
        });

        return {
          success: true,
          subscription,
          payment,
          message:
            "Subscription created successfully. Please complete payment.",
          requiresPayment: true,
          paymentId: payment.id,
          subscriptionId: subscription.id,
        };
      },
      {
        maxWait: 10000, // Maximum time to wait for transaction
        timeout: 10000, // Transaction timeout (10 seconds)
      },
    );

    return result;
  } catch (error: any) {
    console.error("Error creating subscription:", error.message);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      `Failed to create subscription: ${error.message}`,
    );
  }
};

// Get current subscription (Host)
const getCurrentSubscription = async (hostEmail: string) => {
  try {
    const host = await prisma.host.findUnique({
      where: { email: hostEmail },
      include: {
        subscription: {
          include: {
            plan: true,
            payments: {
              where: {
                status: PaymentStatus.COMPLETED,
              },
              orderBy: {
                createdAt: "desc",
              },
              take: 1,
            },
          },
        },
      },
    });

    if (!host) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Host not found");
    }

    // Check for active subscription
    if (
      host.subscription &&
      host.subscription.status === SubscriptionStatus.ACTIVE
    ) {
      return {
        ...host.subscription,
        isActive: true,
        isFree: host.subscription.plan.price === 0,
        lastPayment: host.subscription.payments[0] || null,
      };
    }

    // If no active subscription, return free plan info
    const freePlan = await prisma.subscriptionPlan.findFirst({
      where: { name: "Free", isActive: true },
    });

    if (!freePlan) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Free plan not found");
    }

    return {
      plan: freePlan,
      status: "FREE",
      isFree: true,
      tourLimit: freePlan.tourLimit,
      remainingTours: freePlan.tourLimit,
      blogLimit: freePlan.blogLimit,
      remainingBlogs: freePlan.blogLimit || 0,
      nextBillingDate: null,
      isActive: false,
      message: "You are currently on the free plan",
    };
  } catch (error: any) {
    console.error("Error getting current subscription:", error.message);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      `Failed to get current subscription: ${error.message}`,
    );
  }
};

// Cancel subscription (Host)
const cancelSubscription = async (hostEmail: string) => {
  try {
    const host = await prisma.host.findUnique({
      where: { email: hostEmail },
      include: {
        subscription: {
          include: {
            plan: true,
          },
        },
      },
    });

    if (!host) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Host not found");
    }

    if (!host.subscription) {
      throw new ApiError(StatusCodes.NOT_FOUND, "No subscription found");
    }

    // Don't allow cancelling free plan (they can just not renew)
    if (host.subscription.plan.price === 0) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Free plan cannot be cancelled. It will not auto-renew.",
      );
    }

    // Don't allow cancelling if subscription is already cancelled
    if (host.subscription.status === SubscriptionStatus.CANCELLED) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Subscription is already cancelled",
      );
    }

    // Update subscription to cancelled
    const updatedSubscription = await prisma.subscription.update({
      where: { id: host.subscription.id },
      data: {
        status: SubscriptionStatus.CANCELLED,
        autoRenew: false,
        cancelledAt: new Date(),
      },
    });

    // Downgrade host to free plan after current period ends
    const freePlan = await prisma.subscriptionPlan.findFirst({
      where: { name: "Free", isActive: true },
    });

    if (freePlan) {
      // Don't immediately downgrade, let them use paid features until end date
      // Only downgrade if subscription has ended
      if (new Date() > new Date(host.subscription.endDate)) {
        await prisma.host.update({
          where: { id: host.id },
          data: {
            tourLimit: Math.min(host.tourLimit || 0, freePlan.tourLimit),
          },
        });
      }
    }

    return {
      success: true,
      subscription: updatedSubscription,
      message:
        "Subscription cancelled. You will retain access until the end of your billing period.",
      endDate: updatedSubscription.endDate,
    };
  } catch (error: any) {
    console.error("Error cancelling subscription:", error.message);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      `Failed to cancel subscription: ${error.message}`,
    );
  }
};

// Admin: Get all subscriptions
const getAllSubscriptions = async (params: any, options: IOptions) => {
  const { page, limit, skip, sortBy, sortOrder } =
    paginationHelper.calculatePagination(options);
  const { searchTerm, ...filterData } = params;
  console.log("khfgg ");

  const andConditions: Prisma.SubscriptionWhereInput[] = [];

  if (searchTerm) {
    andConditions.push({
      OR: [
        {
          host: {
            name: {
              contains: searchTerm,
              mode: "insensitive",
            },
          },
        },
        {
          host: {
            email: {
              contains: searchTerm,
              mode: "insensitive",
            },
          },
        },
        {
          plan: {
            name: {
              contains: searchTerm,
              mode: "insensitive",
            },
          },
        },
      ],
    });
  }

  // Filter by status
  if (filterData.status && filterData.status !== "all") {
    andConditions.push({
      status: filterData.status as SubscriptionStatus,
    });
  }

  // Filter by plan
  if (filterData.planId && filterData.planId !== "all") {
    andConditions.push({
      planId: filterData.planId,
    });
  }

  // Filter by host name
  if (filterData.hostName) {
    andConditions.push({
      host: {
        name: {
          contains: filterData.hostName,
          mode: "insensitive",
        },
      },
    });
  }

  // Filter by host email
  if (filterData.hostEmail) {
    andConditions.push({
      host: {
        email: {
          contains: filterData.hostEmail,
          mode: "insensitive",
        },
      },
    });
  }

  const whereConditions: Prisma.SubscriptionWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  const result = await prisma.subscription.findMany({
    skip,
    take: limit,
    where: whereConditions,
    include: {
      host: {
        select: {
          id: true,
          name: true,
          email: true,
          profilePhoto: true,
          currentTourCount: true,
          phone: true,
        },
      },
      plan: true,
      payments: {
        where: {
          status: PaymentStatus.COMPLETED,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
      },
    },
    orderBy: {
      [sortBy]: sortOrder,
    },
  });

  const total = await prisma.subscription.count({
    where: whereConditions,
  });

  return {
    meta: {
      page,
      limit,
      total,
    },
    data: result,
  };
};

// Admin: Get subscription details
const getSubscriptionDetails = async (subscriptionId: string) => {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: {
      host: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
              status: true,
              createdAt: true,
            },
          },
        },
      },
      plan: true,
      payments: {
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  if (!subscription) {
    throw new Error("Subscription not found");
  }

  return subscription;
};

// Admin: Update subscription
const updateSubscription = async (subscriptionId: string, updateData: any) => {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: { host: true, plan: true },
  });

  if (!subscription) {
    throw new Error("Subscription not found");
  }

  const updatePayload: any = {};

  // Handle status change
  if (updateData.status && updateData.status !== subscription.status) {
    updatePayload.status = updateData.status;

    if (updateData.status === SubscriptionStatus.ACTIVE) {
      // Activating subscription should update host
      await updateHostSubscriptionData(
        subscription.hostId,
        subscription.plan,
        subscriptionId,
      );
    } else if (updateData.status === SubscriptionStatus.CANCELLED) {
      updatePayload.cancelledAt = new Date();
      updatePayload.autoRenew = false;
    } else if (updateData.status === SubscriptionStatus.EXPIRED) {
      // Downgrade to free plan when expired
      const freePlan = await prisma.subscriptionPlan.findFirst({
        where: { name: "Free" },
      });

      if (freePlan) {
        await prisma.host.update({
          where: { id: subscription.hostId },
          data: {
            tourLimit: freePlan.tourLimit,
            subscriptionId: null,
          },
        });
      }
    }
  }

  // Handle date extension
  if (updateData.extendDays) {
    const newEndDate = new Date(subscription.endDate);
    newEndDate.setDate(newEndDate.getDate() + updateData.extendDays);
    updatePayload.endDate = newEndDate;
  }

  // Handle manual tour limit adjustment
  if (updateData.adjustTourLimit !== undefined) {
    const newTourLimit = Math.max(
      1,
      subscription.tourLimit + updateData.adjustTourLimit,
    );
    const newRemainingTours = Math.max(
      0,
      (subscription.remainingTours || 0) + updateData.adjustTourLimit,
    );

    updatePayload.tourLimit = newTourLimit;
    updatePayload.remainingTours = newRemainingTours;

    // Update host's tour limit
    await prisma.host.update({
      where: { id: subscription.hostId },
      data: { tourLimit: newTourLimit },
    });
  }

  // Handle manual blog limit adjustment
  if (updateData.adjustBlogLimit !== undefined) {
    const currentBlogLimit = subscription.blogLimit || 0;
    const newBlogLimit = Math.max(
      0,
      currentBlogLimit + updateData.adjustBlogLimit,
    );
    const newRemainingBlogs = Math.max(
      0,
      (subscription.remainingBlogs || 0) + updateData.adjustBlogLimit,
    );

    updatePayload.blogLimit = newBlogLimit === 0 ? null : newBlogLimit;
    updatePayload.remainingBlogs = newRemainingBlogs;
  }

  // Handle admin notes
  if (updateData.adminNotes) {
    updatePayload.adminNotes = updateData.adminNotes;
  }

  const updatedSubscription = await prisma.subscription.update({
    where: { id: subscriptionId },
    data: updatePayload,
    include: {
      host: {
        select: {
          id: true,
          name: true,
          email: true,
          profilePhoto: true,
          currentTourCount: true,
        },
      },
      plan: true,
    },
  });

  return updatedSubscription;
};

// Admin: Delete subscription
const deleteSubscription = async (subscriptionId: string) => {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
  });

  if (!subscription) {
    throw new Error("Subscription not found");
  }

  // Check if subscription is active
  if (subscription.status === SubscriptionStatus.ACTIVE) {
    throw new Error("Cannot delete active subscription. Cancel it first.");
  }

  // Delete associated payments first (if cascade not working)
  await prisma.payment.deleteMany({
    where: { subscriptionId: subscriptionId },
  });

  // Delete the subscription
  const deletedSubscription = await prisma.subscription.delete({
    where: { id: subscriptionId },
  });

  return deletedSubscription;
};

// Admin: Get subscription analytics
const getSubscriptionAnalytics = async () => {
  // Total counts by status
  const countsByStatus = await prisma.subscription.groupBy({
    by: ["status"],
    _count: {
      id: true,
    },
  });

  // Most popular plans
  const popularPlans = await prisma.subscription.groupBy({
    by: ["planId"],
    _count: { id: true },
    orderBy: {
      _count: {
        id: "desc",
      },
    },
    take: 5,
  });

  // Get plan names
  const planDetails = await Promise.all(
    popularPlans.map(async (item) => {
      const plan = await prisma.subscriptionPlan.findUnique({
        where: { id: item.planId },
        select: { name: true, price: true },
      });
      return {
        planId: item.planId,
        planName: plan?.name || "Unknown",
        count: item._count.id,
        price: plan?.price || 0,
      };
    }),
  );

  // Calculate totals
  const totalSubscriptions = countsByStatus.reduce(
    (sum, item) => sum + item._count.id,
    0,
  );
  const activeSubscriptions =
    countsByStatus.find((item) => item.status === SubscriptionStatus.ACTIVE)
      ?._count.id || 0;

  // Monthly revenue (active paid subscriptions)
  const activePaidSubscriptions = await prisma.subscription.findMany({
    where: {
      status: SubscriptionStatus.ACTIVE,
      plan: {
        price: { gt: 0 },
      },
    },
    include: {
      plan: true,
    },
  });

  const monthlyRevenue = activePaidSubscriptions.reduce((sum, sub) => {
    return sum + sub.plan.price / 12; // Convert annual to monthly
  }, 0);

  // Recent payments
  const recentPayments = await prisma.payment.findMany({
    where: {
      subscriptionId: { not: null },
      status: PaymentStatus.COMPLETED,
    },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: {
      subscription: {
        include: {
          host: {
            select: { name: true, email: true },
          },
          plan: {
            select: { name: true },
          },
        },
      },
    },
  });

  return {
    overview: {
      total: totalSubscriptions,
      active: activeSubscriptions,
      cancelled:
        countsByStatus.find(
          (item) => item.status === SubscriptionStatus.CANCELLED,
        )?._count.id || 0,
      pending:
        countsByStatus.find(
          (item) => item.status === SubscriptionStatus.PENDING,
        )?._count.id || 0,
      expired:
        countsByStatus.find(
          (item) => item.status === SubscriptionStatus.EXPIRED,
        )?._count.id || 0,
    },
    revenue: {
      monthly: monthlyRevenue,
      annual: monthlyRevenue * 12,
    },
    popularPlans: planDetails,
    recentPayments: recentPayments,
    upcomingRenewals: await prisma.subscription.findMany({
      where: {
        status: SubscriptionStatus.ACTIVE,
        autoRenew: true,
        endDate: {
          lte: new Date(new Date().setDate(new Date().getDate() + 30)), // Next 30 days
        },
      },
      orderBy: { endDate: "asc" },
      take: 10,
      include: {
        host: {
          select: { name: true, email: true },
        },
        plan: {
          select: { name: true, price: true },
        },
      },
    }),
  };
};

export const SubscriptionService = {
  // Host functions
  createSubscription,
  getCurrentSubscription,
  cancelSubscription,
  initiateSubscriptionPayment,
  getSubscriptionPaymentInfo,

  // Plan management (Admin & Public)
  initializeDefaultPlans,
  createSubscriptionPlan,
  getAllSubscriptionPlans,
  getSingleSubscriptionPlan,
  updateSubscriptionPlan,
  deleteSubscriptionPlan,
  getAllPlans,

  // Admin functions
  getAllSubscriptions,
  getSubscriptionDetails,
  updateSubscription,
  deleteSubscription,
  getSubscriptionAnalytics,
};
