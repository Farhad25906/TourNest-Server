import {
  BookingStatus,
  PaymentStatus,
  PaymentMethod,
  SubscriptionStatus,
} from "@prisma/client";
import { prisma } from "../../shared/prisma";
import Stripe from "stripe";
import { Request } from "express";
import ApiError from "../../errors/ApiError";
import { StatusCodes } from "http-status-codes";
import { paymentPopulateFields } from "./payment.constant";
import { stripe } from "../../config/stripe";

const handleStripeWebhookEvent = async (event: Stripe.Event) => {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as any;

      const bookingId = session.metadata?.bookingId;
      const subscriptionId = session.metadata?.subscriptionId;
      const paymentId = session.metadata?.paymentId;
      const userId = session.metadata?.userId;

      if (!paymentId) {
        console.error(
          "Missing paymentId in session metadata:",
          session.metadata,
        );
        return;
      }

      try {
        // Process booking payment
        if (bookingId) {
          await processBookingPayment(session, bookingId, paymentId, userId);
        }
        // Process subscription payment
        else if (subscriptionId) {
          await processSubscriptionPayment(
            session,
            subscriptionId,
            paymentId,
            userId,
          );
        } else {
          console.error(
            "Unknown payment type in session metadata:",
            session.metadata,
          );
        }
      } catch (error) {
        console.error("Error processing webhook:", error);
        // Optionally send notification about failed webhook
        throw error;
      }
      break;
    }

    case "checkout.session.expired": {
      const session = event.data.object as any;
      const paymentId = session.metadata?.paymentId;
      const bookingId = session.metadata?.bookingId;
      const subscriptionId = session.metadata?.subscriptionId;

      if (paymentId) {
        try {
          // Handle expired sessions
          await prisma.payment.update({
            where: { id: paymentId },
            data: {
              status: PaymentStatus.FAILED,
              metadata: {
                ...session.metadata,
                reason: "session_expired",
                expired_at: new Date().toISOString(),
              },
            },
          });

          console.log(
            `❌ Payment ${paymentId} marked as failed (session expired)`,
          );

          // If it's a subscription payment, update subscription status
          if (subscriptionId) {
            await prisma.subscription.update({
              where: { id: subscriptionId },
              data: {
                status: SubscriptionStatus.CANCELLED,
              },
            });
            console.log(
              `❌ Subscription ${subscriptionId} cancelled due to expired payment`,
            );
          }
        } catch (error) {
          console.error("Error updating expired session:", error);
        }
      }
      break;
    }

    case "payment_intent.succeeded": {
      const paymentIntent = event.data.object as any;
      console.log(`💰 PaymentIntent ${paymentIntent.id} succeeded`);
      break;
    }

    case "payment_intent.payment_failed": {
      const paymentIntent = event.data.object as any;
      console.log(`❌ PaymentIntent ${paymentIntent.id} failed`);
      break;
    }

    default:
      console.log(`ℹ️ Unhandled event type: ${event.type}`);
  }
};

// Helper function to process booking payments
const processBookingPayment = async (
  session: any,
  bookingId: string,
  paymentId: string,
  userId: string,
) => {
  const isPaid = session.payment_status === "paid";
  const paymentStatus = isPaid ? PaymentStatus.COMPLETED : PaymentStatus.FAILED;

  // INCREASE TRANSACTION TIMEOUT and simplify the transaction
  await prisma.$transaction(
    async (tx) => {
      // Get booking details with necessary relations FIRST
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: {
          tour: {
            include: {
              host: true,
            },
          },
          tourist: true,
        },
      });

      if (!booking) {
        console.error(`Booking not found: ${bookingId}`);
        return;
      }

      // Update booking payment status
      const updatedBooking = await tx.booking.update({
        where: { id: bookingId },
        data: {
          paymentStatus: paymentStatus,
          // Only update booking status to CONFIRMED if payment is completed
          ...(isPaid && { status: BookingStatus.CONFIRMED }),
        },
      });

      // Update payment record
      await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: paymentStatus,
          transactionId: session.payment_intent || session.id,
          stripeSessionId: session.id,
          paidAt: isPaid ? new Date() : null,
          metadata: {
            ...session.metadata,
            stripe_session: session.id,
            payment_intent: session.payment_intent,
          },
        },
      });

      // If payment is completed and booking is now CONFIRMED
      if (isPaid && updatedBooking.status === BookingStatus.CONFIRMED) {
        const tour = booking.tour;

        // OPTIMIZATION: Check capacity using a single query instead of fetching all bookings
        const currentGroupSize = await tx.booking.aggregate({
          where: {
            tourId: tour.id,
            status: BookingStatus.CONFIRMED,
            id: { not: bookingId },
          },
          _sum: {
            numberOfPeople: true,
          },
        });

        const totalConfirmedParticipants =
          currentGroupSize._sum.numberOfPeople || 0;

        // Only update if still within capacity
        if (
          totalConfirmedParticipants + booking.numberOfPeople <=
          tour.maxGroupSize
        ) {
          // Update tour group size and earnings in ONE operation
          await tx.tour.update({
            where: { id: tour.id },
            data: {
              currentGroupSize: {
                increment: booking.numberOfPeople,
              },
              totalEarnings: {
                increment: booking.totalAmount,
              },
            },
          });

          // Update host balance (85% to host, 15% platform fee)
          const hostAmount = booking.totalAmount.times(0.85);
          const platformFee = booking.totalAmount.times(0.15);

          await tx.host.update({
            where: { id: tour.hostId },
            data: {
              balance: {
                increment: hostAmount,
              },
              totalEarnings: {
                increment: hostAmount,
              },
            },
          });

          // Update tourist total spent
          if (booking.tourist) {
            await tx.tourist.update({
              where: { id: booking.touristId },
              data: {
                totalSpent: {
                  increment: booking.totalAmount,
                },
              },
            });
          }

          console.log(
            `✅ Tour ${tour.id} group size updated by ${booking.numberOfPeople}`,
          );
          console.log(`💰 Host ${tour.hostId} balance updated: +${hostAmount}`);
        } else {
          console.warn(
            `⚠️ Cannot update tour group size: Capacity exceeded for tour ${tour.id}`,
          );
        }
      }

      console.log(`✅ Payment ${paymentId} processed: ${paymentStatus}`);
    },
    {
      maxWait: 15000, // Maximum time to wait for transaction (15 seconds)
      timeout: 10000, // Maximum time for transaction to complete (10 seconds)
    },
  );
};

// Helper function to process subscription payments
// const processSubscriptionPayment = async (
//   session: any,
//   subscriptionId: string,
//   paymentId: string,
//   userId: string,
// ) => {
//   const isPaid = session.payment_status === "paid";
//   const paymentStatus = isPaid ? PaymentStatus.COMPLETED : PaymentStatus.FAILED;

//   await prisma.$transaction(
//     async (tx) => {
//       // Get subscription details
//       const subscription = await tx.subscription.findUnique({
//         where: { id: subscriptionId },
//         include: {
//           plan: true,
//           host: true,
//         },
//       });

//       if (!subscription) {
//         console.error(`Subscription not found: ${subscriptionId}`);
//         return;
//       }

//       // Update payment record
//       await tx.payment.update({
//         where: { id: paymentId },
//         data: {
//           status: paymentStatus,
//           transactionId: session.payment_intent || session.id,
//           stripeSessionId: session.id,
//           paidAt: isPaid ? new Date() : null,
//           metadata: {
//             ...session.metadata,
//             stripe_session: session.id,
//             payment_intent: session.payment_intent,
//           },
//         },
//       });

//       // If payment is completed, activate the subscription
//       if (isPaid) {
//         // Calculate dates
//         const startDate = new Date();
//         const endDate = new Date(startDate);
//         endDate.setMonth(endDate.getMonth() + subscription.plan.duration);

//         // Update subscription to active
//         await tx.subscription.update({
//           where: { id: subscriptionId },
//           data: {
//             status: SubscriptionStatus.ACTIVE,
//             startDate: startDate,
//             endDate: endDate,
//           },
//         });

//         // Update host with new subscription limits
//         await tx.host.update({
//           where: { id: subscription.hostId },
//           data: {
//             subscriptionId: subscriptionId,
//             tourLimit: subscription.plan.tourLimit || 0,
//             currentTourCount: 0,
//             blogLimit: subscription.plan.blogLimit || 0,
//             currentBlogCount: 0,
//           },
//         });

//         console.log(`✅ Subscription ${subscriptionId} activated`);
//       } else {
//         // If payment failed, update subscription status
//         await tx.subscription.update({
//           where: { id: subscriptionId },
//           data: {
//             status: SubscriptionStatus.CANCELLED,
//           },
//         });
//         console.log(
//           `❌ Subscription ${subscriptionId} cancelled due to payment failure`,
//         );
//       }

//       console.log(
//         `✅ Subscription payment ${paymentId} processed: ${paymentStatus}`,
//       );
//     },
//     {
//       maxWait: 10000,
//       timeout: 8000,
//     },
//   );
// };

// In payment.service.ts - update processSubscriptionPayment
const processSubscriptionPayment = async (
  session: any,
  subscriptionId: string,
  paymentId: string,
  userId: string,
) => {
  const isPaid = session.payment_status === "paid";
  const paymentStatus = isPaid ? PaymentStatus.COMPLETED : PaymentStatus.FAILED;

  await prisma.$transaction(
    async (tx) => {
      // Get subscription details
      const subscription = await tx.subscription.findUnique({
        where: { id: subscriptionId },
        include: {
          plan: true,
          host: true,
        },
      });

      if (!subscription) {
        console.error(`Subscription not found: ${subscriptionId}`);
        return;
      }

      // Update payment record
      await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: paymentStatus,
          transactionId: session.payment_intent || session.id,
          stripeSessionId: session.id,
          paidAt: isPaid ? new Date() : null,
          metadata: {
            ...session.metadata,
            stripe_session: session.id,
            payment_intent: session.payment_intent,
          },
        },
      });

      // If payment is completed, activate the subscription
      if (isPaid) {
        // Calculate dates
        const startDate = new Date();
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + subscription.plan.duration);

        // Update subscription to active
        await tx.subscription.update({
          where: { id: subscriptionId },
          data: {
            status: SubscriptionStatus.ACTIVE,
            startDate: startDate,
            endDate: endDate,
          },
        });

        // Update host with new subscription limits
        await tx.host.update({
          where: { id: subscription.hostId },
          data: {
            subscriptionId: subscriptionId,
            tourLimit: subscription.plan.tourLimit || 0,
            currentTourCount: 0,
            blogLimit: subscription.plan.blogLimit || undefined,
            currentBlogCount: 0,
          },
        });

        console.log(`✅ Subscription ${subscriptionId} activated`);
      } else {
        // If payment failed, update subscription status
        await tx.subscription.update({
          where: { id: subscriptionId },
          data: {
            status: SubscriptionStatus.CANCELLED,
          },
        });
        console.log(
          `❌ Subscription ${subscriptionId} cancelled due to payment failure`,
        );
      }

      console.log(
        `✅ Subscription payment ${paymentId} processed: ${paymentStatus}`,
      );
    },
    {
      maxWait: 10000,
      timeout: 8000,
    },
  );
};

const getUserPayments = async (req: Request) => {
  const userEmail = req.user?.email;

  if (!userEmail) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, "User email not found");
  }

  const user = await prisma.user.findUnique({
    where: { email: userEmail },
  });

  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
  }

  const result = await prisma.payment.findMany({
    where: { userId: user.id },
    orderBy: {
      createdAt: "desc",
    },
    include: {
      ...paymentPopulateFields,
      booking: {
        include: {
          tour: {
            include: {
              host: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      },
      subscription: {
        include: {
          plan: true,
        },
      },
    },
  });

  return result;
};

const getHostEarnings = async (req: Request) => {
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

  const payments = await prisma.payment.findMany({
    where: {
      booking: {
        tour: {
          hostId: host.id,
        },
      },
      status: "COMPLETED",
    },
    orderBy: {
      paidAt: "desc",
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          tourist: {
            select: {
              name: true,
              profilePhoto: true,
            },
          },
        },
      },
      booking: {
        include: {
          tour: {
            select: {
              id: true,
              title: true,
              destination: true,
              startDate: true,
              endDate: true,
            },
          },
        },
      },
    },
  });

  // Calculate total earnings
  const totalEarnings = payments.reduce((sum, payment) => {
    return sum + payment.amount.toNumber();
  }, 0);

  // Calculate earnings by month for the last 6 months
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const recentPayments = payments.filter(
    (payment) => payment.paidAt && payment.paidAt >= sixMonthsAgo,
  );

  const earningsByMonth = recentPayments.reduce((acc: any, payment) => {
    if (!payment.paidAt) return acc;

    const month = payment.paidAt.toISOString().slice(0, 7); // YYYY-MM
    if (!acc[month]) {
      acc[month] = 0;
    }
    acc[month] += payment.amount.toNumber();
    return acc;
  }, {});

  return {
    payments,
    summary: {
      totalEarnings,
      totalTransactions: payments.length,
      pendingBalance: host.balance.toNumber(),
      totalEarningsToDate: host.totalEarnings.toNumber(),
    },
    earningsByMonth: Object.entries(earningsByMonth).map(
      ([month, earnings]) => ({
        month,
        earnings: earnings as number,
      }),
    ),
  };
};

const getAllPayments = async () => {
  const payments = await prisma.payment.findMany({
    orderBy: {
      createdAt: "desc",
    },
    include: {
      ...paymentPopulateFields,
      booking: {
        include: {
          tour: {
            include: {
              host: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      },
      user: {
        select: {
          id: true,
          email: true,
          role: true,
          tourist: {
            select: {
              name: true,
              profilePhoto: true,
            },
          },
        },
      },
      subscription: {
        include: {
          plan: true,
          host: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
    },
  });

  // Get payment statistics
  const totalAmount = payments.reduce((sum, payment) => {
    return sum + payment.amount.toNumber();
  }, 0);

  const statusCounts = payments.reduce((acc: any, payment) => {
    if (!acc[payment.status]) {
      acc[payment.status] = 0;
    }
    acc[payment.status]++;
    return acc;
  }, {});

  // Separate booking and subscription payments
  const bookingPayments = payments.filter((p) => p.bookingId);
  const subscriptionPayments = payments.filter((p) => p.subscriptionId);

  return {
    payments,
    stats: {
      totalAmount,
      totalTransactions: payments.length,
      bookingTransactions: bookingPayments.length,
      subscriptionTransactions: subscriptionPayments.length,
      statusCounts,
    },
  };
};

// Get subscription payments (for host to see their subscription payments)
const getSubscriptionPayments = async (req: Request) => {
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

  const result = await prisma.payment.findMany({
    where: {
      subscription: {
        hostId: host.id,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    include: {
      subscription: {
        include: {
          plan: true,
        },
      },
    },
  });

  return result;
};

// Update the export to include new functions
export const PaymentService = {
  handleStripeWebhookEvent,
  getUserPayments,
  getHostEarnings,
  getAllPayments,
  getSubscriptionPayments,
  processBookingPayment, // Exported for testing
  processSubscriptionPayment, // Exported for testing
};
