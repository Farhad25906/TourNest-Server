// import { BookingStatus, PaymentStatus } from "@prisma/client";
// import { prisma } from "../../shared/prisma";
// import Stripe from "stripe";

// // Add these imports at the top
// import { Request } from "express";
// import { Prisma } from "@prisma/client";
// import { IOptions, paginationHelper } from "../../helper/paginationHelper";
// import {
//   paymentSearchableFields,
//   paymentPopulateFields,
// } from "./payment.constant";
// import ApiError from "../../errors/ApiError";
// import { StatusCodes } from "http-status-codes";

// // Add these new functions to the PaymentService
// const handleStripeWebhookEvent = async (event: Stripe.Event) => {
//   switch (event.type) {
//     case "checkout.session.completed": {
//       const session = event.data.object as any;

//       const bookingId = session.metadata?.bookingId;
//       const paymentId = session.metadata?.paymentId;
//       const userId = session.metadata?.userId;

//       if (!bookingId || !paymentId) {
//         console.error("Missing metadata in session:", session.metadata);
//         return;
//       }

//       try {
//         // Start a transaction to ensure data consistency
//         await prisma.$transaction(async (tx) => {
//           // Get booking details first
//           const booking = await tx.booking.findUnique({
//             where: { id: bookingId },
//             include: {
//               tour: {
//                 include: {
//                   host: true,
//                 },
//               },
//             },
//           });

//           if (!booking) {
//             console.error(`Booking not found: ${bookingId}`);
//             return;
//           }

//           // Check if payment was successful
//           const isPaid = session.payment_status === "paid";
//           const paymentStatus = isPaid
//             ? PaymentStatus.COMPLETED
//             : PaymentStatus.FAILED;

//           // Update booking payment status
//           const updatedBooking = await tx.booking.update({
//             where: { id: bookingId },
//             data: {
//               paymentStatus: paymentStatus,
//               // Only update booking status to CONFIRMED if payment is completed
//               ...(isPaid && { status: BookingStatus.CONFIRMED }),
//             },
//             include: {
//               tour: {
//                 include: {
//                   host: true,
//                 },
//               },
//             },
//           });

//           // Update payment record
//           await tx.payment.update({
//             where: { id: paymentId },
//             data: {
//               status: paymentStatus,
//               transactionId: session.payment_intent || session.id,
//               stripeSessionId: session.id,
//               paidAt: isPaid ? new Date() : null,
//               metadata: {
//                 ...session.metadata,
//                 stripe_session: session.id,
//                 payment_intent: session.payment_intent,
//               },
//             },
//           });

//           // If payment is completed and booking is now CONFIRMED
//           if (isPaid && updatedBooking.status === BookingStatus.CONFIRMED) {
//             const tour = updatedBooking.tour;

//             // Check if tour has enough capacity
//             const currentConfirmedBookings = await tx.booking.findMany({
//               where: {
//                 tourId: tour.id,
//                 status: BookingStatus.CONFIRMED,
//                 id: { not: bookingId },
//               },
//             });

//             const totalConfirmedParticipants = currentConfirmedBookings.reduce(
//               (sum, b) => sum + b.numberOfPeople,
//               0
//             );

//             // Only update if still within capacity
//             if (
//               totalConfirmedParticipants + updatedBooking.numberOfPeople <=
//               tour.maxGroupSize
//             ) {
//               // Update tour group size
//               await tx.tour.update({
//                 where: { id: tour.id },
//                 data: {
//                   currentGroupSize: {
//                     increment: updatedBooking.numberOfPeople,
//                   },
//                   totalEarnings: {
//                     increment: updatedBooking.totalAmount,
//                   },
//                 },
//               });

//               console.log(
//                 `✅ Tour ${tour.id} group size updated by ${updatedBooking.numberOfPeople}`
//               );

//               // Update host balance (85% to host, 15% platform fee)
//               const hostAmount = updatedBooking.totalAmount.times(0.85);
//               const platformFee = updatedBooking.totalAmount.times(0.15);

//               await tx.host.update({
//                 where: { id: tour.hostId },
//                 data: {
//                   balance: {
//                     increment: hostAmount,
//                   },
//                   totalEarnings: {
//                     increment: hostAmount,
//                   },
//                 },
//               });

//               // Update tourist total spent
//               await tx.tourist.update({
//                 where: { id: updatedBooking.touristId },
//                 data: {
//                   totalSpent: {
//                     increment: updatedBooking.totalAmount,
//                   },
//                 },
//               });

//               console.log(
//                 `💰 Host ${tour.hostId} balance updated: +${hostAmount}`
//               );
//               console.log(`📊 Platform fee: ${platformFee}`);
//             } else {
//               console.warn(
//                 `⚠️ Cannot update tour group size: Capacity exceeded for tour ${tour.id}`
//               );
//             }
//           }

//           console.log(`✅ Payment ${paymentId} processed: ${paymentStatus}`);
//           console.log(
//             `✅ Booking ${bookingId} updated: ${updatedBooking.status}, ${updatedBooking.paymentStatus}`
//           );
//         });
//       } catch (error) {
//         console.error("Error processing webhook:", error);
//         throw error;
//       }
//       break;
//     }

//     case "checkout.session.expired": {
//       const session = event.data.object as any;
//       const paymentId = session.metadata?.paymentId;

//       if (paymentId) {
//         try {
//           await prisma.payment.update({
//             where: { id: paymentId },
//             data: {
//               status: PaymentStatus.FAILED,
//               metadata: {
//                 ...session.metadata,
//                 reason: "session_expired",
//                 expired_at: new Date().toISOString(),
//               },
//             },
//           });
//           console.log(
//             `❌ Payment ${paymentId} marked as failed (session expired)`
//           );
//         } catch (error) {
//           console.error("Error updating expired session:", error);
//         }
//       }
//       break;
//     }

//     case "payment_intent.succeeded": {
//       const paymentIntent = event.data.object as any;
//       console.log(`💰 PaymentIntent ${paymentIntent.id} succeeded`);
//       break;
//     }

//     case "payment_intent.payment_failed": {
//       const paymentIntent = event.data.object as any;
//       console.log(`❌ PaymentIntent ${paymentIntent.id} failed`);
//       break;
//     }

//     default:
//       console.log(`ℹ️ Unhandled event type: ${event.type}`);
//   }
// };
// const getUserPayments = async (
//   req: Request,
//   params: any,
//   options: IOptions
// ) => {
//   const userEmail = req.user?.email;

//   if (!userEmail) {
//     throw new ApiError(StatusCodes.UNAUTHORIZED, "User email not found");
//   }

//   const user = await prisma.user.findUnique({
//     where: { email: userEmail },
//   });

//   if (!user) {
//     throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
//   }

//   const { page, limit, skip, sortBy, sortOrder } =
//     paginationHelper.calculatePagination(options);
//   const {
//     searchTerm,
//     minAmount,
//     maxAmount,
//     startDate,
//     endDate,
//     ...filterData
//   } = params;

//   const andConditions: Prisma.PaymentWhereInput[] = [{ userId: user.id }];

//   // Search term filter
//   if (searchTerm) {
//     andConditions.push({
//       OR: paymentSearchableFields.map((field) => ({
//         [field]: {
//           contains: searchTerm,
//           mode: "insensitive",
//         },
//       })),
//     });
//   }

//   // Amount range filter
//   if (minAmount !== undefined || maxAmount !== undefined) {
//     const amountCondition: any = {};
//     if (minAmount !== undefined)
//       amountCondition.gte = new Prisma.Decimal(minAmount);
//     if (maxAmount !== undefined)
//       amountCondition.lte = new Prisma.Decimal(maxAmount);
//     andConditions.push({ amount: amountCondition });
//   }

//   // Date range filter
//   if (startDate) {
//     andConditions.push({
//       createdAt: {
//         gte: new Date(startDate),
//       },
//     });
//   }

//   if (endDate) {
//     andConditions.push({
//       createdAt: {
//         lte: new Date(endDate),
//       },
//     });
//   }

//   // Other filters
//   if (Object.keys(filterData).length > 0) {
//     andConditions.push({
//       AND: Object.keys(filterData).map((key) => ({
//         [key]: {
//           equals: (filterData as any)[key],
//         },
//       })),
//     });
//   }

//   const whereConditions: Prisma.PaymentWhereInput =
//     andConditions.length > 0 ? { AND: andConditions } : {};

//   const result = await prisma.payment.findMany({
//     skip,
//     take: limit,
//     where: whereConditions,
//     orderBy: {
//       [sortBy]: sortOrder,
//     },
//     include: {
//       ...paymentPopulateFields,
//       booking: {
//         include: {
//           tour: {
//             include: {
//               host: {
//                 select: {
//                   id: true,
//                   name: true,
//                   email: true,
//                 },
//               },
//             },
//           },
//         },
//       },
//     },
//   });

//   const total = await prisma.payment.count({
//     where: whereConditions,
//   });

//   return {
//     meta: {
//       page,
//       limit,
//       total,
//       totalPages: Math.ceil(total / limit),
//     },
//     data: result,
//   };
// };

// const getHostEarnings = async (
//   req: Request,
//   params: any,
//   options: IOptions
// ) => {
//   const hostEmail = req.user?.email;

//   if (!hostEmail) {
//     throw new ApiError(StatusCodes.UNAUTHORIZED, "Host email not found");
//   }

//   const host = await prisma.host.findUnique({
//     where: { email: hostEmail },
//   });

//   if (!host) {
//     throw new ApiError(StatusCodes.NOT_FOUND, "Host not found");
//   }

//   const { page, limit, skip, sortBy, sortOrder } =
//     paginationHelper.calculatePagination(options);
//   const {
//     searchTerm,
//     minAmount,
//     maxAmount,
//     startDate,
//     endDate,
//     ...filterData
//   } = params;

//   const andConditions: Prisma.PaymentWhereInput[] = [
//     {
//       booking: {
//         tour: {
//           hostId: host.id,
//         },
//       },
//       status: "COMPLETED", // Only show completed payments for earnings
//     },
//   ];

//   // Search term filter
//   if (searchTerm) {
//     andConditions.push({
//       OR: [
//         {
//           booking: {
//             tour: {
//               title: {
//                 contains: searchTerm,
//                 mode: "insensitive",
//               },
//             },
//           },
//         },
//         {
//           user: {
//             email: {
//               contains: searchTerm,
//               mode: "insensitive",
//             },
//           },
//         },
//       ],
//     });
//   }

//   // Amount range filter
//   if (minAmount !== undefined || maxAmount !== undefined) {
//     const amountCondition: any = {};
//     if (minAmount !== undefined)
//       amountCondition.gte = new Prisma.Decimal(minAmount);
//     if (maxAmount !== undefined)
//       amountCondition.lte = new Prisma.Decimal(maxAmount);
//     andConditions.push({ amount: amountCondition });
//   }

//   // Date range filter
//   if (startDate) {
//     andConditions.push({
//       paidAt: {
//         gte: new Date(startDate),
//       },
//     });
//   }

//   if (endDate) {
//     andConditions.push({
//       paidAt: {
//         lte: new Date(endDate),
//       },
//     });
//   }

//   const whereConditions: Prisma.PaymentWhereInput =
//     andConditions.length > 0 ? { AND: andConditions } : {};

//   const result = await prisma.payment.findMany({
//     skip,
//     take: limit,
//     where: whereConditions,
//     orderBy: {
//       [sortBy]: sortOrder,
//     },
//     include: {
//       user: {
//         select: {
//           id: true,
//           email: true,
//           tourist: {
//             select: {
//               name: true,
//               profilePhoto: true,
//             },
//           },
//         },
//       },
//       booking: {
//         include: {
//           tour: {
//             select: {
//               id: true,
//               title: true,
//               destination: true,
//               startDate: true,
//               endDate: true,
//             },
//           },
//         },
//       },
//     },
//   });

//   const total = await prisma.payment.count({
//     where: whereConditions,
//   });

//   // Calculate total earnings
//   const totalEarningsResult = await prisma.payment.aggregate({
//     where: whereConditions,
//     _sum: {
//       amount: true,
//     },
//   });

//   const totalEarnings =
//     totalEarningsResult._sum.amount || new Prisma.Decimal(0);

//   // Calculate earnings by month for the last 6 months
//   const sixMonthsAgo = new Date();
//   sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

//   const earningsByMonth = await prisma.payment.groupBy({
//     by: ["paidAt"],
//     where: {
//       ...whereConditions,
//       paidAt: {
//         gte: sixMonthsAgo,
//       },
//     },
//     _sum: {
//       amount: true,
//     },
//   });

//   return {
//     meta: {
//       page,
//       limit,
//       total,
//       totalPages: Math.ceil(total / limit),
//     },
//     data: {
//       payments: result,
//       summary: {
//         totalEarnings: totalEarnings.toNumber(),
//         totalTransactions: total,
//         pendingBalance: host.balance.toNumber(),
//         totalEarningsToDate: host.totalEarnings.toNumber(),
//       },
//       earningsByMonth: earningsByMonth.map((item) => ({
//         month: item.paidAt?.toISOString().slice(0, 7) || "Unknown",
//         earnings: item._sum.amount?.toNumber() || 0,
//       })),
//     },
//   };
// };

// const getAllPayments = async (params: any, options: IOptions) => {
//   const { page, limit, skip, sortBy, sortOrder } =
//     paginationHelper.calculatePagination(options);
//   const {
//     searchTerm,
//     minAmount,
//     maxAmount,
//     startDate,
//     endDate,
//     ...filterData
//   } = params;

//   const andConditions: Prisma.PaymentWhereInput[] = [];

//   // Search term filter
//   if (searchTerm) {
//     andConditions.push({
//       OR: paymentSearchableFields.map((field) => ({
//         [field]: {
//           contains: searchTerm,
//           mode: "insensitive",
//         },
//       })),
//     });
//   }

//   // Amount range filter
//   if (minAmount !== undefined || maxAmount !== undefined) {
//     const amountCondition: any = {};
//     if (minAmount !== undefined)
//       amountCondition.gte = new Prisma.Decimal(minAmount);
//     if (maxAmount !== undefined)
//       amountCondition.lte = new Prisma.Decimal(maxAmount);
//     andConditions.push({ amount: amountCondition });
//   }

//   // Date range filter
//   if (startDate) {
//     andConditions.push({
//       createdAt: {
//         gte: new Date(startDate),
//       },
//     });
//   }

//   if (endDate) {
//     andConditions.push({
//       createdAt: {
//         lte: new Date(endDate),
//       },
//     });
//   }

//   // Other filters
//   if (Object.keys(filterData).length > 0) {
//     andConditions.push({
//       AND: Object.keys(filterData).map((key) => ({
//         [key]: {
//           equals: (filterData as any)[key],
//         },
//       })),
//     });
//   }

//   const whereConditions: Prisma.PaymentWhereInput =
//     andConditions.length > 0 ? { AND: andConditions } : {};

//   const result = await prisma.payment.findMany({
//     skip,
//     take: limit,
//     where: whereConditions,
//     orderBy: {
//       [sortBy]: sortOrder,
//     },
//     include: {
//       ...paymentPopulateFields,
//       booking: {
//         include: {
//           tour: {
//             include: {
//               host: {
//                 select: {
//                   id: true,
//                   name: true,
//                   email: true,
//                 },
//               },
//             },
//           },
//         },
//       },
//       user: {
//         select: {
//           id: true,
//           email: true,
//           role: true,
//           tourist: {
//             select: {
//               name: true,
//               profilePhoto: true,
//             },
//           },
//         },
//       },
//     },
//   });

//   const total = await prisma.payment.count({
//     where: whereConditions,
//   });

//   // Get payment statistics
//   const paymentStats = await prisma.payment.aggregate({
//     where: whereConditions,
//     _sum: {
//       amount: true,
//     },
//     _count: {
//       _all: true,
//     },
//   });

//   const statusCounts = await prisma.payment.groupBy({
//     by: ["status"],
//     where: whereConditions,
//     _count: {
//       _all: true,
//     },
//   });

//   return {
//     meta: {
//       page,
//       limit,
//       total,
//       totalPages: Math.ceil(total / limit),
//     },
//     data: {
//       payments: result,
//       stats: {
//         totalAmount: paymentStats._sum.amount?.toNumber() || 0,
//         totalTransactions: paymentStats._count._all,
//         statusCounts: statusCounts.reduce((acc, item) => {
//           acc[item.status] = item._count._all;
//           return acc;
//         }, {} as Record<string, number>),
//       },
//     },
//   };
// };

// // Update the export to include new functions
// export const PaymentService = {
//   handleStripeWebhookEvent,
//   getUserPayments,
//   getHostEarnings,
//   getAllPayments,
// };


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
        // Start a transaction to ensure data consistency
        await prisma.$transaction(async (tx) => {
          // Get booking details first
          const booking = await tx.booking.findUnique({
            where: { id: bookingId },
            include: {
              tour: {
                include: {
                  host: true,
                },
              },
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
            include: {
              tour: {
                include: {
                  host: true,
                },
              },
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
            const tour = updatedBooking.tour;

            // Check if tour has enough capacity
            const currentConfirmedBookings = await tx.booking.findMany({
              where: {
                tourId: tour.id,
                status: BookingStatus.CONFIRMED,
                id: { not: bookingId },
              },
            });

            const totalConfirmedParticipants = currentConfirmedBookings.reduce(
              (sum, b) => sum + b.numberOfPeople,
              0
            );

            // Only update if still within capacity
            if (
              totalConfirmedParticipants + updatedBooking.numberOfPeople <=
              tour.maxGroupSize
            ) {
              // Update tour group size
              await tx.tour.update({
                where: { id: tour.id },
                data: {
                  currentGroupSize: {
                    increment: updatedBooking.numberOfPeople,
                  },
                  totalEarnings: {
                    increment: updatedBooking.totalAmount,
                  },
                },
              });

              console.log(
                `✅ Tour ${tour.id} group size updated by ${updatedBooking.numberOfPeople}`
              );

              // Update host balance (85% to host, 15% platform fee)
              const hostAmount = updatedBooking.totalAmount.times(0.85);
              const platformFee = updatedBooking.totalAmount.times(0.15);

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
              await tx.tourist.update({
                where: { id: updatedBooking.touristId },
                data: {
                  totalSpent: {
                    increment: updatedBooking.totalAmount,
                  },
                },
              });

              console.log(
                `💰 Host ${tour.hostId} balance updated: +${hostAmount}`
              );
              console.log(`📊 Platform fee: ${platformFee}`);
            } else {
              console.warn(
                `⚠️ Cannot update tour group size: Capacity exceeded for tour ${tour.id}`
              );
            }
          }

          console.log(`✅ Payment ${paymentId} processed: ${paymentStatus}`);
          console.log(
            `✅ Booking ${bookingId} updated: ${updatedBooking.status}, ${updatedBooking.paymentStatus}`
          );
        });
      } catch (error) {
        console.error("Error processing webhook:", error);
        throw error;
      }
      break;
    }

    case "checkout.session.expired": {
      const session = event.data.object as any;
      const paymentId = session.metadata?.paymentId;

      if (paymentId) {
        try {
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
    earningsByMonth: Object.entries(earningsByMonth).map(([month, earnings]) => ({
      month,
      earnings: earnings as number,
    })),
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
