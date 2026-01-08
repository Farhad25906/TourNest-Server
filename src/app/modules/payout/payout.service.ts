// payout.service.ts
import { Request } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../../shared/prisma";
import ApiError from "../../errors/ApiError";
import { StatusCodes } from "http-status-codes";
import { stripe } from "../../config/stripe";

// Payout Request interface
interface CreatePayoutRequest {
  amount: number;
  currency?: string;
  method?: "bank" | "stripe";
  bankDetails?: {
    accountNumber: string;
    routingNumber: string;
    accountHolderName: string;
  };
}

const requestPayout = async (req: Request, payoutData: CreatePayoutRequest) => {
  const hostEmail = req.user?.email;

  if (!hostEmail) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, "Host email not found");
  }

  const host = await prisma.host.findUnique({
    where: { email: hostEmail },
  });

  if (!host) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Host not found");
  }

  const {
    amount,
    currency = "USD",
    method = "stripe",
    bankDetails,
  } = payoutData;

  // Validate amount
  if (amount <= 0) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Amount must be greater than 0"
    );
  }

  // Check if host has sufficient balance
  if (host.balance.lessThan(amount)) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `Insufficient balance. Available: ${host.balance}, Requested: ${amount}`
    );
  }

  // Minimum payout amount
  const MIN_PAYOUT_AMOUNT = 50; // $50 minimum
  if (amount < MIN_PAYOUT_AMOUNT) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `Minimum payout amount is $${MIN_PAYOUT_AMOUNT}`
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    // Create payout record
    const payout = await tx.payout.create({
      data: {
        hostId: host.id,
        amount: new Prisma.Decimal(amount),
        currency,
        payoutMethod: method,
        status: "PENDING",
        bankDetails: bankDetails || undefined,
      },
    });

    // Hold the amount from host's balance
    await tx.host.update({
      where: { id: host.id },
      data: {
        balance: {
          decrement: amount,
        },
      },
    });

    return payout;
  });

  // Process payout based on method
  if (method === "stripe" && host.stripeCustomerId) {
    await processStripePayout(host.id, host.stripeCustomerId, amount, currency);
  }

  return result;
};

const processStripePayout = async (
  hostId: string,
  stripeCustomerId: string,
  amount: number,
  currency: string
) => {
  try {
    // Create a transfer to the host's Stripe account
    const transfer = await stripe.transfers.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: currency.toLowerCase(),
      destination: stripeCustomerId,
      description: `Payout for host ${hostId}`,
    });

    // Update payout status
    await prisma.payout.updateMany({
      where: {
        hostId,
        status: "PENDING",
      },
      data: {
        status: "COMPLETED",
        transactionId: transfer.id,
        processedAt: new Date(),
      },
    });

    // Update host's last payout time
    await prisma.host.update({
      where: { id: hostId },
      data: {
        lastPayoutAt: new Date(),
      },
    });

    console.log(
      `✅ Payout completed for host ${hostId}: ${amount} ${currency}`
    );
  } catch (error) {
    console.error("Stripe payout failed:", error);

    // Revert the balance if payout fails
    await prisma.$transaction(async (tx) => {
      await tx.payout.updateMany({
        where: {
          hostId,
          status: "PENDING",
        },
        data: {
          status: "FAILED",
          failureReason:
            error instanceof Error ? error.message : "Unknown error occurred",
        },
      });

      await tx.host.update({
        where: { id: hostId },
        data: {
          balance: {
            increment: amount,
          },
        },
      });
    });

    throw new ApiError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      `Payout failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
};

const getHostPayouts = async (req: Request, params: any) => {
  const hostEmail = req.user?.email;

  if (!hostEmail) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, "Host email not found");
  }

  const host = await prisma.host.findUnique({
    where: { email: hostEmail },
  });

  if (!host) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Host not found");
  }

  const { status, startDate, endDate } = params;

  const whereCondition: any = {
    hostId: host.id,
  };

  if (status) {
    whereCondition.status = status;
  }

  if (startDate || endDate) {
    whereCondition.createdAt = {};
    if (startDate) whereCondition.createdAt.gte = new Date(startDate);
    if (endDate) whereCondition.createdAt.lte = new Date(endDate);
  }

  const payouts = await prisma.payout.findMany({
    where: whereCondition,
    orderBy: {
      createdAt: "desc",
    },
    include: {
      host: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  // Calculate statistics
  const totalPayouts = payouts.length;
  const totalAmount = payouts.reduce(
    (sum, payout) => sum + payout.amount.toNumber(),
    0
  );
  const completedPayouts = payouts.filter(
    (p) => p.status === "COMPLETED"
  ).length;
  const pendingPayouts = payouts.filter((p) => p.status === "PENDING").length;
  const failedPayouts = payouts.filter((p) => p.status === "FAILED").length;

  return {
    payouts,
    statistics: {
      totalPayouts,
      totalAmount,
      completedPayouts,
      pendingPayouts,
      failedPayouts,
    },
  };
};

const getPayoutStats = async (req: Request) => {
  const hostEmail = req.user?.email;

  if (!hostEmail) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, "Host email not found");
  }

  const host = await prisma.host.findUnique({
    where: { email: hostEmail },
  });

  if (!host) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Host not found");
  }

  // Get last 30 days payouts
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentPayouts = await prisma.payout.findMany({
    where: {
      hostId: host.id,
      createdAt: {
        gte: thirtyDaysAgo,
      },
      status: "COMPLETED",
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  // Calculate monthly payout amounts
  const monthlyPayouts = recentPayouts.reduce((acc, payout) => {
    const month = payout.createdAt.toISOString().slice(0, 7); // YYYY-MM
    if (!acc[month]) {
      acc[month] = 0;
    }
    acc[month] += payout.amount.toNumber();
    return acc;
  }, {} as Record<string, number>);

  return {
    currentBalance: host.balance.toNumber(),
    totalEarnings: host.totalEarnings.toNumber(),
    lastPayoutAt: host.lastPayoutAt,
    recentPayouts: recentPayouts.slice(0, 5),
    monthlyPayouts,
    minimumPayoutAmount: 50, // $50 minimum
  };
};

export const PayoutService = {
  requestPayout,
  getHostPayouts,
  getPayoutStats,
};
