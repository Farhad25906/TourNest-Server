import { BookingStatus, PaymentStatus } from "@prisma/client";
import { prisma } from "../../shared/prisma";
import Stripe from "stripe";
import { Request } from "express";
import ApiError from "../../errors/ApiError";
import { StatusCodes } from "http-status-codes";
import { paymentPopulateFields } from "./payment.constant";

const handleStripeWebhookEvent = async (event: Stripe.Event) => {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as any;

      const bookingId = session.metadata?.bookingId;
      const paymentId = session.metadata?.paymentId;
      const userId = session.metadata?.userId;

      if (!bookingId || !paymentId) {
        console.error("Missing metadata in session:", session.metadata);
        return;
      }

      try {
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

            // Check if payment was successful
            const isPaid = session.payment_status === "paid";
            const paymentStatus = isPaid
              ? PaymentStatus.COMPLETED
              : PaymentStatus.FAILED;

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
                  `✅ Tour ${tour.id} group size updated by ${booking.numberOfPeople}`
                );
                console.log(
                  `💰 Host ${tour.hostId} balance updated: +${hostAmount}`
                );
              } else {
                console.warn(
                  `⚠️ Cannot update tour group size: Capacity exceeded for tour ${tour.id}`
                );
              }
            }

            console.log(`✅ Payment ${paymentId} processed: ${paymentStatus}`);
          },
          {
            maxWait: 15000, // Maximum time to wait for transaction (15 seconds)
            timeout: 10000, // Maximum time for transaction to complete (10 seconds)
          }
        );
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

      if (paymentId) {
        try {
          // Handle expired sessions outside of transaction to be faster
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
            `❌ Payment ${paymentId} marked as failed (session expired)`
          );
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
    (payment) => payment.paidAt && payment.paidAt >= sixMonthsAgo
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
      })
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

  return {
    payments,
    stats: {
      totalAmount,
      totalTransactions: payments.length,
      statusCounts,
    },
  };
};

// Update the export to include new functions
export const PaymentService = {
  handleStripeWebhookEvent,
  getUserPayments,
  getHostEarnings,
  getAllPayments,
};
