import { Request } from "express";
import {
  Booking,
  Prisma,
  BookingStatus,
  PaymentStatus,
  PaymentMethod,
} from "@prisma/client";
import { prisma } from "../../shared/prisma";
import { IOptions, paginationHelper } from "../../helper/paginationHelper";
import {
  bookingSearchableFields,
  bookingPopulateFields,
} from "./booking.constant";
import { IJWTPayload } from "../../types/common";
import ApiError from "../../errors/ApiError";
import { StatusCodes } from "http-status-codes";
import { stripe } from "../../config/stripe";
import envVars from "../../config/env";

const createBooking = async (req: Request): Promise<any> => {
  const userEmail = req.user?.email;

  if (!userEmail) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, "User email not found");
  }

  // Get user info
  const user = await prisma.user.findUnique({
    where: { email: userEmail },
    include: { tourist: true },
  });

  if (!user || !user.tourist) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "User not found or not a tourist"
    );
  }

  const {
    tourId,
    numberOfPeople,
    totalAmount,
    specialRequests,
    paymentMethod = "STRIPE", // Default to STRIPE
  } = req.body;

  // Get tour info
  const tour = await prisma.tour.findUnique({
    where: { id: tourId },
  });

  if (!tour) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Tour not found");
  }

  // Check if user already has a booking for this tour
  const existingBooking = await prisma.booking.findFirst({
    where: {
      tourId,
      userId: user.id,
      status: {
        in: ["PENDING", "CONFIRMED"],
      },
    },
  });

  if (existingBooking) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "You already have a booking for this tour"
    );
  }

  // Check if tour has available spots
  const currentConfirmedBookings = await prisma.booking.findMany({
    where: {
      tourId,
      status: "CONFIRMED",
    },
  });

  const totalConfirmedParticipants = currentConfirmedBookings.reduce(
    (sum, booking) => sum + booking.numberOfPeople,
    0
  );

  if (totalConfirmedParticipants + numberOfPeople > tour.maxGroupSize) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `Only ${
        tour.maxGroupSize - totalConfirmedParticipants
      } spots available for this tour`
    );
  }

  // Determine initial status based on payment method
  const initialStatus: BookingStatus =
    paymentMethod === "COD" ? "CONFIRMED" : "PENDING";
  const initialPaymentStatus: PaymentStatus =
    paymentMethod === "COD" ? "PENDING" : "PENDING";

  // Create booking
  const bookingData = {
    userId: user.id,
    touristId: user.tourist.id,
    tourId,
    numberOfPeople: numberOfPeople,
    totalAmount: new Prisma.Decimal(totalAmount),
    specialRequests,
    status: initialStatus,
    paymentStatus: initialPaymentStatus,
    isReviewed: false,
    bookingDate: new Date(),
  };

  const result = await prisma.$transaction(async (tx) => {
    // Create the booking
    const booking = await tx.booking.create({
      data: bookingData,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            // name: true,
          },
        },
        tourist: {
          select: {
            id: true,
            name: true,
          },
        },
        tour: {
          select: {
            id: true,
            title: true,
            destination: true,
            host: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    // For COD, create a pending payment record
    if (paymentMethod === "COD") {
      await tx.payment.create({
        data: {
          userId: user.id,
          bookingId: booking.id,
          amount: new Prisma.Decimal(totalAmount),
          currency: "USD",
          paymentMethod: "COD",
          status: "PENDING",
          description: `Cash on Delivery for booking ${booking.id}`,
          metadata: {
            bookingId: booking.id,
            tourTitle: tour.title,
            destination: tour.destination,
          },
        },
      });

      // Update tour group size immediately for COD
      await tx.tour.update({
        where: { id: tourId },
        data: {
          currentGroupSize: {
            increment: numberOfPeople,
          },
        },
      });
    }

    return booking;
  });

  return {
    booking: result,
    requiresPayment: paymentMethod !== "COD",
    paymentMethod,
  };
};

const initiateBookingPayment = async (bookingId: string, userEmail: string) => {
  const user = await prisma.user.findUnique({
    where: { email: userEmail },
    select: { id: true, email: true },
  });

  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
  }

  const userId = user.id;
  // Get booking details
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      tour: {
        select: {
          id: true,
          title: true,
          destination: true,
          images: true,
          host: {
            select: {
              name: true,
            },
          },
        },
      },
      user: {
        select: {
          id: true,
          email: true,
        },
      },
    },
  });

  if (!booking) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Booking not found");
  }

  console.log(booking.userId, userId);

  if (booking.userId !== userId) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      "You are not authorized to pay for this booking"
    );
  }

  // Check if booking is already paid
  if (booking.paymentStatus === PaymentStatus.COMPLETED) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "This booking is already paid");
  }

  // Check if booking is cancelled
  if (booking.status === BookingStatus.CANCELLED) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "This booking is cancelled");
  }

  // Check for existing active payment session
  const existingPayment = await prisma.payment.findFirst({
    where: {
      bookingId,
      status: {
        in: [PaymentStatus.PENDING, PaymentStatus.PROCESSING],
      },
    },
  });

  if (existingPayment && existingPayment.stripeSessionId) {
    try {
      const session = await stripe.checkout.sessions.retrieve(
        existingPayment.stripeSessionId
      );
      if (session.status === "open") {
        return {
          paymentUrl: session.url,
          sessionId: session.id,
          paymentId: existingPayment.id,
        };
      }
    } catch (error) {
      // Session doesn't exist or expired, continue to create new one
      console.log("Previous session expired, creating new one");
    }
  }

  // Create payment record
  const payment = await prisma.payment.create({
    data: {
      userId,
      bookingId,
      amount: booking.totalAmount,
      currency: "USD",
      paymentMethod: PaymentMethod.STRIPE,
      status: PaymentStatus.PENDING,
      description: `Payment for tour: ${booking.tour.title}`,
      metadata: {
        bookingDetails: {
          tourTitle: booking.tour.title,
          destination: booking.tour.destination,
          numberOfPeople: booking.numberOfPeople,
          hostName: booking.tour.host.name,
        },
      },
    },
  });

  // Create Stripe Checkout Session
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    customer_email: booking.user.email,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: booking.tour.title,
            description: `${booking.tour.destination} - ${booking.numberOfPeople} person(s)`,
            images: booking.tour.images,
          },
          unit_amount: Math.round(booking.totalAmount.toNumber() * 100),
        },
        quantity: 1,
      },
    ],
    metadata: {
      bookingId,
      userId,
      paymentId: payment.id,
      tourTitle: booking.tour.title,
      destination: booking.tour.destination,
    },
    success_url: `${envVars.FRONTEND_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${envVars.FRONTEND_URL}/payment/cancel?booking_id=${bookingId}`,
  });

  // Update payment with session info
  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      stripeSessionId: session.id,
      status: PaymentStatus.PROCESSING,
    },
  });

  // RETURN THE RESULT - This was missing!
  return {
    paymentUrl: session.url,
    sessionId: session.id,
    paymentId: payment.id,
  };
};

const getAllBookings = async (params: any, options: IOptions) => {
  const { page, limit, skip, sortBy, sortOrder } =
    paginationHelper.calculatePagination(options);
  const { searchTerm, minPrice, maxPrice, startDate, endDate, ...filterData } =
    params;

  const andConditions: Prisma.BookingWhereInput[] = [];

  // Search term filter
  if (searchTerm) {
    andConditions.push({
      OR: bookingSearchableFields.map((field) => ({
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
    andConditions.push({ totalAmount: priceCondition });
  }

  // Date range filter
  if (startDate) {
    andConditions.push({
      bookingDate: {
        gte: new Date(startDate),
      },
    });
  }

  if (endDate) {
    andConditions.push({
      bookingDate: {
        lte: new Date(endDate),
      },
    });
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

  const whereConditions: Prisma.BookingWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  const result = await prisma.booking.findMany({
    skip,
    take: limit,
    where: whereConditions,
    orderBy: {
      [sortBy]: sortOrder,
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          role: true,
        },
      },
      tourist: {
        select: {
          id: true,
          name: true,
          email: true,
          profilePhoto: true,
          // Remove phone field since Tourist model doesn't have it
          // Check your schema for available fields
          bio: true,
          location: true,
          // Only include fields that exist in your Tourist model
        },
      },
      tour: {
        select: {
          id: true,
          title: true,
          destination: true,
          city: true,
          startDate: true,
          endDate: true,
          price: true,
          images: true,
          host: {
            select: {
              id: true,
              name: true,
              email: true,
              profilePhoto: true,
            },
          },
        },
      },
      payments: {
        select: {
          id: true,
          amount: true,
          status: true,
          paymentMethod: true,
          transactionId: true,
          paidAt: true,
        },
      },
    },
  });

  const total = await prisma.booking.count({
    where: whereConditions,
  });

  return {
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    data: result,
  };
};

const getMyBookings = async (req: Request, params: any, options: IOptions) => {
  const userEmail = req.user?.email;

  if (!userEmail) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, "User email not found");
  }

  const user = await prisma.user.findUnique({
    where: { email: userEmail },
    include: {
      tourist: true, // Include tourist to get the name
    },
  });

  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
  }

  if (!user.tourist) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Tourist profile not found");
  }

  const { page, limit, skip, sortBy, sortOrder } =
    paginationHelper.calculatePagination(options);
  const { searchTerm, minPrice, maxPrice, startDate, endDate, ...filterData } =
    params;

  const andConditions: Prisma.BookingWhereInput[] = [
    { userId: user.id }, // Filter by current user's ID
  ];

  // Add other filters
  if (searchTerm) {
    andConditions.push({
      OR: [
        {
          tour: {
            title: {
              contains: searchTerm,
              mode: "insensitive",
            },
          },
        },
        {
          tour: {
            destination: {
              contains: searchTerm,
              mode: "insensitive",
            },
          },
        },
        // Add search by tourist name if needed
        {
          tourist: {
            name: {
              contains: searchTerm,
              mode: "insensitive",
            },
          },
        },
      ],
    });
  }

  // Price range filter
  if (minPrice !== undefined || maxPrice !== undefined) {
    const priceCondition: any = {};
    if (minPrice !== undefined) priceCondition.gte = Number(minPrice);
    if (maxPrice !== undefined) priceCondition.lte = Number(maxPrice);
    andConditions.push({ totalAmount: priceCondition });
  }

  // Date range filter
  if (startDate) {
    andConditions.push({
      bookingDate: {
        gte: new Date(startDate),
      },
    });
  }

  if (endDate) {
    andConditions.push({
      bookingDate: {
        lte: new Date(endDate),
      },
    });
  }

  // Status filter
  if (filterData.status) {
    andConditions.push({ status: filterData.status });
  }

  const whereConditions: Prisma.BookingWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  const result = await prisma.booking.findMany({
    skip,
    take: limit,
    where: whereConditions,
    orderBy: {
      [sortBy]: sortOrder,
    },
    include: {
      // Include tourist instead of user for name
      tourist: {
        select: {
          id: true,
          name: true,
          email: true,
          profilePhoto: true,
          // phone: true,
          bio: true,
          interests: true,
          location: true,
          visitedCountries: true,
        },
      },
      // You can still include basic user info if needed
      user: {
        select: {
          id: true,
          email: true,
          role: true,
          // profilePhoto: true,
          status: true,
        },
      },
      tour: {
        include: {
          host: {
            select: {
              id: true,
              name: true, // Host has name field
              email: true,
              profilePhoto: true,
              phone: true,
            },
          },
        },
      },
      payments: {
        select: {
          id: true,
          amount: true,
          status: true,
          paymentMethod: true,
          transactionId: true,
          paidAt: true,
        },
      },
    },
  });

  const total = await prisma.booking.count({
    where: whereConditions,
  });

  return {
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    data: result,
  };
};

const getHostBookings = async (
  req: Request,
  params: any,
  options: IOptions
) => {
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

  const { page, limit, skip, sortBy, sortOrder } =
    paginationHelper.calculatePagination(options);
  const { searchTerm, minPrice, maxPrice, startDate, endDate, ...filterData } =
    params;

  const andConditions: Prisma.BookingWhereInput[] = [
    {
      tour: {
        hostId: host.id,
      },
    },
  ];

  // Add other filters
  if (searchTerm) {
    andConditions.push({
      OR: [
        // {
        //   user: {
        //     name: {
        //       contains: searchTerm,
        //       mode: "insensitive",
        //     },
        //   },
        // },
        {
          user: {
            email: {
              contains: searchTerm,
              mode: "insensitive",
            },
          },
        },
        {
          tour: {
            title: {
              contains: searchTerm,
              mode: "insensitive",
            },
          },
        },
      ],
    });
  }

  // Price range filter
  if (minPrice !== undefined || maxPrice !== undefined) {
    const priceCondition: any = {};
    if (minPrice !== undefined) priceCondition.gte = Number(minPrice);
    if (maxPrice !== undefined) priceCondition.lte = Number(maxPrice);
    andConditions.push({ totalAmount: priceCondition });
  }

  // Date range filter
  if (startDate) {
    andConditions.push({
      bookingDate: {
        gte: new Date(startDate),
      },
    });
  }

  if (endDate) {
    andConditions.push({
      bookingDate: {
        lte: new Date(endDate),
      },
    });
  }

  // Status filter
  if (filterData.status) {
    andConditions.push({ status: filterData.status });
  }

  const whereConditions: Prisma.BookingWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  const result = await prisma.booking.findMany({
    skip,
    take: limit,
    where: whereConditions,
    orderBy: {
      [sortBy]: sortOrder,
    },
    include: {
      ...bookingPopulateFields,
      user: {
        select: {
          id: true,
          email: true,
          tourist: {
            select: {
              name: true,
              profilePhoto: true,
              location: true,
            },
          },
        },
      },
      payments: {
        select: {
          id: true,
          amount: true,
          status: true,
          paymentMethod: true,
          transactionId: true,
          paidAt: true,
        },
      },
    },
  });

  const total = await prisma.booking.count({
    where: whereConditions,
  });

  return {
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    data: result,
  };
};

const getSingleBooking = async (id: string, user: IJWTPayload) => {
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      ...bookingPopulateFields,
      tour: {
        include: {
          host: {
            select: {
              id: true,
              name: true,
              email: true,
              profilePhoto: true,
              phone: true,
              bio: true,
            },
          },
        },
      },
      payments: {
        select: {
          id: true,
          amount: true,
          status: true,
          paymentMethod: true,
          transactionId: true,
          stripeSessionId: true,
          paidAt: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  if (!booking) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Booking not found");
  }

  // Authorization check
  const userData = await prisma.user.findUnique({
    where: { email: user.email },
    include: { tourist: true, host: true },
  });

  if (!userData) {
    throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
  }

  const isAdmin = userData.role === "ADMIN";
  const isBookingOwner = booking.userId === userData.id;
  const isHostOwner = userData.host?.id === booking.tour.hostId;

  if (!isAdmin && !isBookingOwner && !isHostOwner) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      "You are not authorized to view this booking"
    );
  }

  return booking;
};

const getBookingPaymentInfo = async (bookingId: string, userId: string) => {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      payments: {
        where: {
          status: {
            in: ["PENDING", "PROCESSING", "COMPLETED"],
          },
        },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      tour: {
        select: {
          title: true,
          destination: true,
          images: true,
          startDate: true,
          endDate: true,
        },
      },
    },
  });

  if (!booking) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Booking not found");
  }

  if (booking.userId !== userId) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      "You are not authorized to view this booking"
    );
  }

  const latestPayment = booking.payments[0];
  const canPay =
    booking.paymentStatus === "PENDING" || booking.paymentStatus === "FAILED";
  const isPaid = booking.paymentStatus === "COMPLETED";

  return {
    booking,
    payment: latestPayment,
    canPay,
    isPaid,
    paymentStatus: booking.paymentStatus,
    bookingStatus: booking.status,
  };
};

const updateBooking = async (
  id: string,
  user: IJWTPayload,
  updateData: any
) => {
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      tour: true,
    },
  });

  if (!booking) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Booking not found");
  }

  // Authorization check
  const userData = await prisma.user.findUnique({
    where: { email: user.email },
  });

  if (!userData) {
    throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
  }

  const isAdmin = userData.role === "ADMIN";
  const isBookingOwner = booking.userId === userData.id;

  if (!isAdmin && !isBookingOwner) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      "You are not authorized to update this booking"
    );
  }

  // Check if booking can be updated
  if (booking.status === "CANCELLED" || booking.status === "COMPLETED") {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `Cannot update a ${booking.status.toLowerCase()} booking`
    );
  }

  // Handle participants change
  if (
    updateData.numberOfPeople &&
    updateData.numberOfPeople !== booking.numberOfPeople
  ) {
    const participantsChange =
      updateData.numberOfPeople - booking.numberOfPeople;

    // Check if tour has enough capacity
    const tour = await prisma.tour.findUnique({
      where: { id: booking.tourId },
    });

    if (!tour) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Tour not found");
    }

    const currentBookings = await prisma.booking.findMany({
      where: {
        tourId: booking.tourId,
        status: "CONFIRMED",
        id: { not: booking.id },
      },
    });

    const totalConfirmedParticipants = currentBookings.reduce(
      (sum, b) => sum + b.numberOfPeople,
      0
    );

    if (
      totalConfirmedParticipants + updateData.numberOfPeople >
      tour.maxGroupSize
    ) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        `Cannot update to ${updateData.numberOfPeople} participants. Only ${
          tour.maxGroupSize - totalConfirmedParticipants
        } spots available`
      );
    }

    // Update tour's current group size if booking is confirmed
    if (booking.status === "CONFIRMED") {
      await prisma.tour.update({
        where: { id: booking.tourId },
        data: {
          currentGroupSize: {
            increment: participantsChange,
          },
        },
      });
    }
  }

  const result = await prisma.booking.update({
    where: { id },
    data: updateData,
    include: {
      ...bookingPopulateFields,
      payments: {
        select: {
          id: true,
          amount: true,
          status: true,
          paymentMethod: true,
        },
      },
    },
  });

  return result;
};

const updateBookingStatus = async (
  id: string,
  user: IJWTPayload,
  updateData: any
) => {
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      tour: true,
    },
  });

  if (!booking) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Booking not found");
  }

  // Authorization check - only host of the tour or admin can update status
  const userData = await prisma.user.findUnique({
    where: { email: user.email },
    include: { host: true },
  });

  if (!userData) {
    throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
  }

  const isAdmin = userData.role === "ADMIN";
  const isHostOwner = userData.host?.id === booking.tour.hostId;

  if (!isAdmin && !isHostOwner) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      "You are not authorized to update this booking status"
    );
  }

  const result = await prisma.booking.update({
    where: { id },
    data: { status: updateData.status },
    include: {
      ...bookingPopulateFields,
      payments: {
        select: {
          id: true,
          amount: true,
          status: true,
        },
      },
    },
  });

  return result;
};

const cancelBooking = async (id: string, user: IJWTPayload) => {
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      tour: true,
    },
  });

  if (!booking) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Booking not found");
  }

  // Authorization check
  const userData = await prisma.user.findUnique({
    where: { email: user.email },
  });

  if (!userData) {
    throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
  }

  const isAdmin = userData.role === "ADMIN";
  const isBookingOwner = booking.userId === userData.id;

  if (!isAdmin && !isBookingOwner) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      "You are not authorized to cancel this booking"
    );
  }

  // Check if booking can be cancelled
  if (booking.status === "CANCELLED") {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Booking is already cancelled");
  }

  if (booking.status === "COMPLETED") {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Cannot cancel a completed booking"
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    // Update booking status and payment status
    const updatedBooking = await tx.booking.update({
      where: { id },
      data: {
        status: "CANCELLED",
        paymentStatus: "CANCELLED",
      },
      include: bookingPopulateFields,
    });

    // Decrement tour's current group size if booking was confirmed
    if (booking.status === "CONFIRMED") {
      await tx.tour.update({
        where: { id: booking.tourId },
        data: {
          currentGroupSize: {
            decrement: booking.numberOfPeople,
          },
        },
      });
    }

    // Update any pending payments to cancelled
    await tx.payment.updateMany({
      where: {
        bookingId: id,
        status: {
          in: ["PENDING", "PROCESSING"],
        },
      },
      data: {
        status: "CANCELLED",
      },
    });

    return updatedBooking;
  });

  return result;
};

const deleteBooking = async (id: string) => {
  const booking = await prisma.booking.findUnique({
    where: { id },
  });

  if (!booking) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Booking not found");
  }

  const result = await prisma.$transaction(async (tx) => {
    // Decrement tour's current group size if booking was confirmed
    if (booking.status === "CONFIRMED") {
      await tx.tour.update({
        where: { id: booking.tourId },
        data: {
          currentGroupSize: {
            decrement: booking.numberOfPeople,
          },
        },
      });
    }

    // Delete associated payments first
    await tx.payment.deleteMany({
      where: { bookingId: id },
    });

    // Delete the booking
    return await tx.booking.delete({
      where: { id },
    });
  });

  return result;
};

const getHostBookingStats = async (req: Request) => {
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

  // Get all bookings for host's tours
  const bookings = await prisma.booking.findMany({
    where: {
      tour: {
        hostId: host.id,
      },
    },
    include: {
      tour: true,
      payments: {
        where: {
          status: "COMPLETED",
        },
      },
    },
  });

  // Calculate statistics
  const now = new Date();
  const totalBookings = bookings.length;
  const confirmedBookings = bookings.filter(
    (b) => b.status === "CONFIRMED"
  ).length;
  const pendingBookings = bookings.filter((b) => b.status === "PENDING").length;
  const cancelledBookings = bookings.filter(
    (b) => b.status === "CANCELLED"
  ).length;
  const completedBookings = bookings.filter(
    (b) => b.status === "COMPLETED"
  ).length;

  const totalRevenue = bookings
    .filter((b) => b.payments.length > 0) // Only count bookings with completed payments
    .reduce((sum, booking) => sum + booking.totalAmount.toNumber(), 0);

  // Bookings by month (last 6 months)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const bookingsByMonth = await prisma.booking.groupBy({
    by: ["bookingDate"],
    where: {
      tour: {
        hostId: host.id,
      },
      bookingDate: {
        gte: sixMonthsAgo,
      },
    },
    _count: {
      _all: true,
    },
    _sum: {
      totalAmount: true,
    },
  });

  // Recent bookings (last 10)
  const recentBookings = bookings
    .sort(
      (a, b) =>
        new Date(b.bookingDate).getTime() - new Date(a.bookingDate).getTime()
    )
    .slice(0, 10)
    .map((booking) => ({
      id: booking.id,
      bookingDate: booking.bookingDate,
      status: booking.status,
      totalAmount: booking.totalAmount.toNumber(),
      numberOfPeople: booking.numberOfPeople,
      tourTitle: booking.tour?.title,
      userName: booking.userId,
    }));

  // Upcoming bookings
  const upcomingBookings = bookings.filter(
    (booking) =>
      booking.status === "CONFIRMED" &&
      new Date(booking.tour?.startDate || now) > now
  ).length;

  return {
    totalBookings,
    confirmedBookings,
    pendingBookings,
    cancelledBookings,
    completedBookings,
    totalRevenue,
    upcomingBookings,
    bookingsByMonth: bookingsByMonth.map((item) => ({
      month: item.bookingDate.toISOString().slice(0, 7),
      count: item._count._all,
      revenue: item._sum.totalAmount?.toNumber() || 0,
    })),
    recentBookings,
  };
};

const getUserBookingStats = async (req: Request) => {
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

  // Get all user's bookings
  const bookings = await prisma.booking.findMany({
    where: {
      userId: user.id,
    },
    include: {
      tour: true,
      payments: {
        where: {
          status: "COMPLETED",
        },
      },
    },
  });

  // Calculate statistics
  const now = new Date();
  const totalBookings = bookings.length;
  const confirmedBookings = bookings.filter(
    (b) => b.status === "CONFIRMED"
  ).length;
  const pendingBookings = bookings.filter((b) => b.status === "PENDING").length;
  const cancelledBookings = bookings.filter(
    (b) => b.status === "CANCELLED"
  ).length;
  const completedBookings = bookings.filter(
    (b) => b.status === "COMPLETED"
  ).length;

  const totalSpent = bookings
    .filter((b) => b.payments.length > 0) // Only count bookings with completed payments
    .reduce((sum, booking) => sum + booking.totalAmount.toNumber(), 0);

  // Upcoming trips
  const upcomingTrips = bookings.filter(
    (booking) =>
      booking.status === "CONFIRMED" &&
      new Date(booking.tour?.startDate || now) > now
  ).length;

  // Past trips
  const pastTrips = bookings.filter(
    (booking) =>
      booking.status === "COMPLETED" ||
      (booking.status === "CONFIRMED" &&
        new Date(booking.tour?.endDate || now) < now)
  ).length;

  // Favorite destination (by number of bookings)
  const destinationCounts = bookings.reduce((acc, booking) => {
    const destination = booking.tour?.destination || "Unknown";
    acc[destination] = (acc[destination] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const favoriteDestination = Object.entries(destinationCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([destination, count]) => ({ destination, count }))
    .slice(0, 1)[0] || { destination: "None", count: 0 };

  // Recent bookings
  const recentBookings = bookings
    .sort(
      (a, b) =>
        new Date(b.bookingDate).getTime() - new Date(a.bookingDate).getTime()
    )
    .slice(0, 5)
    .map((booking) => ({
      id: booking.id,
      tourTitle: booking.tour?.title,
      destination: booking.tour?.destination,
      bookingDate: booking.bookingDate,
      status: booking.status,
      totalAmount: booking.totalAmount.toNumber(),
      isPaid: booking.payments.length > 0,
    }));

  return {
    totalBookings,
    confirmedBookings,
    pendingBookings,
    cancelledBookings,
    completedBookings,
    totalSpent,
    upcomingTrips,
    pastTrips,
    favoriteDestination,
    recentBookings,
  };
};

const completeBooking = async (id: string, user: IJWTPayload) => {
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      tour: {
        include: {
          host: true,
        },
      },
    },
  });

  if (!booking) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Booking not found");
  }

  // Authorization check - only host or admin can mark as completed
  const userData = await prisma.user.findUnique({
    where: { email: user.email },
    include: { host: true },
  });

  if (!userData) {
    throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
  }

  const isAdmin = userData.role === "ADMIN";
  const isHostOwner = userData.host?.id === booking.tour.hostId;

  if (!isAdmin && !isHostOwner) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      "You are not authorized to complete this booking"
    );
  }

  // Check if tour has ended
  const tourEndDate = new Date(booking.tour.endDate);
  const currentDate = new Date();

  if (tourEndDate > currentDate) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Cannot complete booking before tour ends"
    );
  }

  // Check if booking is confirmed
  if (booking.status !== "CONFIRMED") {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `Cannot complete a ${booking.status.toLowerCase()} booking`
    );
  }

  const result = await prisma.booking.update({
    where: { id },
    data: {
      status: "COMPLETED",
    },
    include: {
      ...bookingPopulateFields,
    },
  });

  return result;
};

export const BookingService = {
  createBooking,
  getAllBookings,
  getMyBookings,
  getHostBookings,
  getSingleBooking,
  updateBooking,
  updateBookingStatus,
  cancelBooking,
  deleteBooking,
  getHostBookingStats,
  getUserBookingStats,
  getBookingPaymentInfo,
  initiateBookingPayment,
  completeBooking,
};
