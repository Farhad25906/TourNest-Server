// subscription.service.ts
import {
  Subscription,
  SubscriptionPlan,
  SubscriptionStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "../../shared/prisma";
import { IOptions, paginationHelper } from "../../helper/paginationHelper";
import {
  subscriptionPlanSearchableFields,
  subscriptionSearchableFields,
  DEFAULT_SUBSCRIPTION_PLANS,
} from "./subscription.constant";
import { IJWTPayload } from "../../types/common";

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

    return { success: true, message: "Plans already exist" };
  } catch (error: any) {
    console.error("❌ Error initializing plans:", error.message);
    throw new Error(`Failed to initialize plans: ${error.message}`);
  }
};

// Create subscription plan (Admin)
const createSubscriptionPlan = async (payload: any): Promise<SubscriptionPlan> => {
  const result = await prisma.subscriptionPlan.create({
    data: payload,
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
const updateSubscriptionPlan = async (id: string, data: any): Promise<SubscriptionPlan> => {
  const plan = await prisma.subscriptionPlan.findUnique({
    where: { id },
  });

  if (!plan) {
    throw new Error("Subscription plan not found");
  }

  const result = await prisma.subscriptionPlan.update({
    where: { id },
    data,
  });

  return result;
};

// Delete subscription plan (Admin)
const deleteSubscriptionPlan = async (id: string): Promise<SubscriptionPlan> => {
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

// Create subscription (Host)
const createSubscription = async (user: IJWTPayload, planId: string) => {
  try {
    // Find host
    const host = await prisma.host.findUnique({
      where: { email: user.email },
      include: { user: true },
    });

    if (!host) {
      throw new Error("Host not found");
    }

    // Get subscription plan
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      throw new Error("Subscription plan not found");
    }

    if (!plan.isActive) {
      throw new Error("This subscription plan is not available");
    }

    // Check for existing active subscription
    const existingActiveSubscription = await prisma.subscription.findFirst({
      where: {
        hostId: host.id,
        status: "ACTIVE",
      },
    });

    if (existingActiveSubscription && plan.price > 0) {
      throw new Error(
        "You already have an active subscription. Please cancel it first."
      );
    }

    // Calculate dates
    const startDate = new Date();
    const endDate = new Date();
    endDate.setFullYear(endDate.getFullYear() + 1); // 1 year subscription

    // Create subscription
    const subscription = await prisma.subscription.create({
      data: {
        hostId: host.id,
        planId: plan.id,
        startDate,
        endDate,
        status: plan.price === 0 ? "ACTIVE" : "PENDING", // Free plans active immediately
        autoRenew: true,
        tourLimit: plan.tourLimit,
        remainingTours: plan.tourLimit,
        blogLimit: plan.blogLimit,
        remainingBlogs: plan.blogLimit || 0,
      },
      include: {
        plan: true,
      },
    });

    // If free plan, update host immediately
    if (plan.price === 0) {
      await prisma.host.update({
        where: { id: host.id },
        data: {
          tourLimit: plan.tourLimit,
          currentTourCount: 0,
          subscriptionId: subscription.id,
        },
      });

      return {
        success: true,
        subscription,
        message: "Free subscription activated successfully",
      };
    }

    // For paid plans, return pending subscription
    return {
      success: true,
      subscription,
      message: "Subscription created successfully. Please complete payment.",
    };
  } catch (error: any) {
    console.error("Error creating subscription:", error.message);
    throw new Error(`Failed to create subscription: ${error.message}`);
  }
};

// Get current subscription (Host)
const getCurrentSubscription = async (hostEmail: string) => {
  try {
    const host = await prisma.host.findUnique({
      where: { email: hostEmail },
    });

    if (!host) {
      throw new Error("Host not found");
    }

    const subscription = await prisma.subscription.findFirst({
      where: {
        hostId: host.id,
        status: "ACTIVE",
      },
      include: {
        plan: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // If no active subscription, return free plan info
    if (!subscription) {
      const freePlan = await prisma.subscriptionPlan.findFirst({
        where: { name: "Free" },
      });

      return {
        plan: freePlan,
        status: "FREE",
        isFree: true,
        tourLimit: freePlan?.tourLimit || 4,
        remainingTours: freePlan?.tourLimit || 4,
        blogLimit: freePlan?.blogLimit || 5,
        remainingBlogs: freePlan?.blogLimit || 5,
        nextBillingDate: null,
        isActive: false,
      };
    }

    return {
      ...subscription,
      isActive: true,
      isFree: subscription.plan.price === 0,
    };
  } catch (error: any) {
    console.error("Error getting current subscription:", error.message);
    throw new Error(`Failed to get current subscription: ${error.message}`);
  }
};

// Cancel subscription (Host)
const cancelSubscription = async (hostEmail: string) => {
  try {
    const host = await prisma.host.findUnique({
      where: { email: hostEmail },
    });

    if (!host) {
      throw new Error("Host not found");
    }

    const subscription = await prisma.subscription.findFirst({
      where: {
        hostId: host.id,
        status: "ACTIVE",
      },
    });

    if (!subscription) {
      throw new Error("No active subscription found");
    }

    // Update subscription to cancelled
    const updatedSubscription = await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: "CANCELLED",
        autoRenew: false,
        cancelledAt: new Date(),
      },
    });

    // Downgrade host to free plan
    const freePlan = await prisma.subscriptionPlan.findFirst({
      where: { name: "Free" },
    });

    if (freePlan) {
      await prisma.host.update({
        where: { id: host.id },
        data: {
          tourLimit: freePlan.tourLimit,
          currentTourCount: Math.min(host.currentTourCount, freePlan.tourLimit),
          subscriptionId: null,
        },
      });
    }

    return updatedSubscription;
  } catch (error: any) {
    console.error("Error cancelling subscription:", error.message);
    throw new Error(`Failed to cancel subscription: ${error.message}`);
  }
};

// Admin: Get all subscriptions
const getAllSubscriptions = async (params: any, options: IOptions) => {
  const { page, limit, skip, sortBy, sortOrder } =
    paginationHelper.calculatePagination(options);
  const { searchTerm, ...filterData } = params;

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
        // {
        //   status: {
        //     contains: searchTerm,
        //     mode: "insensitive",
        //   },
        // },
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
        },
      },
      plan: true,
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

    if (updateData.status === "CANCELLED") {
      updatePayload.cancelledAt = new Date();
      updatePayload.autoRenew = false;
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
    updatePayload.tourLimit = Math.max(
      1,
      subscription.tourLimit + updateData.adjustTourLimit
    );
    updatePayload.remainingTours = Math.max(
      0,
      (subscription.remainingTours || 0) + updateData.adjustTourLimit
    );
  }

  // Handle manual blog limit adjustment
  if (
    updateData.adjustBlogLimit !== undefined &&
    subscription.blogLimit !== null
  ) {
    updatePayload.blogLimit = Math.max(
      0,
      (subscription.blogLimit || 0) + updateData.adjustBlogLimit
    );
    updatePayload.remainingBlogs = Math.max(
      0,
      (subscription.remainingBlogs || 0) + updateData.adjustBlogLimit
    );
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
  if (subscription.status === "ACTIVE") {
    throw new Error("Cannot delete active subscription. Cancel it first.");
  }

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
    where: { status: "ACTIVE" },
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
      };
    })
  );

  // Calculate totals
  const totalSubscriptions = countsByStatus.reduce((sum, item) => sum + item._count.id, 0);
  const activeSubscriptions = countsByStatus.find((item) => item.status === "ACTIVE")?._count.id || 0;

  return {
    overview: {
      total: totalSubscriptions,
      active: activeSubscriptions,
      cancelled: countsByStatus.find((item) => item.status === "CANCELLED")?._count.id || 0,
      pending: countsByStatus.find((item) => item.status === "PENDING")?._count.id || 0,
      expired: countsByStatus.find((item) => item.status === "EXPIRED")?._count.id || 0,
    },
    metrics: {
      activeSubscribers: activeSubscriptions,
    },
    popularPlans: planDetails,
    recentActivity: await prisma.subscription.findMany({
      where: {
        OR: [{ status: "ACTIVE" }, { status: "CANCELLED" }],
      },
      orderBy: { updatedAt: "desc" },
      take: 10,
      include: {
        host: {
          select: { name: true, email: true },
        },
        plan: {
          select: { name: true },
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

  // Plan management (Admin & Public)
  initializeDefaultPlans,
  createSubscriptionPlan,
  getAllSubscriptionPlans,
  getSingleSubscriptionPlan,
  updateSubscriptionPlan,
  deleteSubscriptionPlan,

  // Admin functions
  getAllSubscriptions,
  getSubscriptionDetails,
  updateSubscription,
  deleteSubscription,
  getSubscriptionAnalytics,
};