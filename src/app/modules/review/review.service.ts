// review.service.ts
import { Request } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../../shared/prisma";
import { IOptions, paginationHelper } from "../../helper/paginationHelper";
import {
  reviewSearchableFields,
  reviewPopulateFields,
} from "./review.constant";
import { IJWTPayload } from "../../types/common";
import ApiError from "../../errors/ApiError";
import { StatusCodes } from "http-status-codes";

const createReview = async (req: Request): Promise<any> => {
  const userEmail = req.user?.email;
  const { bookingId, rating, comment } = req.body;

  if (!userEmail) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, "User email not found");
  }

  // Get user
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

  // Get booking
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      tour: true,
    },
  });

  if (!booking) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Booking not found");
  }

  // Validations
  if (booking.userId !== user.id) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      "You can only review your own bookings"
    );
  }

  if (booking.status !== "COMPLETED") {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "You can only review completed tours"
    );
  }

  const existingReview = await prisma.review.findUnique({
    where: { bookingId },
  });

  if (existingReview) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "You have already reviewed this booking"
    );
  }

  // SIMPLE TRANSACTION - only essential writes
  const review = await prisma.$transaction(async (tx) => {
    // 1. Create review
    const newReview = await tx.review.create({
      data: {
        bookingId,
        rating,
        comment,
        hostId: booking.tour.hostId,
        touristId: booking.tour.id,
        tourId: booking.tourId,
      },
      include: {
        ...reviewPopulateFields,
      },
    });

    // 2. Update booking
    await tx.booking.update({
      where: { id: bookingId },
      data: {
        isReviewed: true,
      },
    });

    return newReview;
  }, {
    timeout: 8000, // 8 seconds should be plenty
  });

  // Update ratings separately (not in transaction)
  try {
    // Calculate and update tour rating
    const tourStats = await prisma.review.aggregate({
      where: {
        tourId: booking.tourId,
        isApproved: true,
        isDeleted: false,
      },
      _avg: { rating: true },
      _count: { rating: true },
    });

    await prisma.tour.update({
      where: { id: booking.tourId },
      data: {
        averageRating: tourStats._avg.rating || 0,
        totalReviews: tourStats._count.rating,
      },
    });

    // Calculate and update host rating
    const hostStats = await prisma.review.aggregate({
      where: {
        hostId: booking.tour.hostId,
        isApproved: true,
        isDeleted: false,
      },
      _avg: { rating: true },
      _count: { rating: true },
    });

    await prisma.host.update({
      where: { id: booking.tour.hostId },
      data: {
        averageRating: hostStats._avg.rating || 0,
        totalReviews: hostStats._count.rating,
      },
    });
  } catch (error) {
    console.error('Failed to update ratings:', error);
    // Don't fail the review creation if rating updates fail
    // Can implement retry logic here
  }

  return review;
};

const updateTourRating = async (
  tx: Prisma.TransactionClient,
  tourId: string
) => {
  const reviews = await tx.review.findMany({
    where: {
      tourId,
      isApproved: true,
      isDeleted: false,
    },
    select: {
      rating: true,
    },
  });

  if (reviews.length > 0) {
    const averageRating =
      reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;

    await tx.tour.update({
      where: { id: tourId },
      data: {
        averageRating: averageRating,
        totalReviews: reviews.length,
      },
    });
  }
};

const updateHostRating = async (
  tx: Prisma.TransactionClient,
  hostId: string
) => {
  const reviews = await tx.review.findMany({
    where: {
      hostId,
      isApproved: true,
      isDeleted: false,
    },
    select: {
      rating: true,
    },
  });

  if (reviews.length > 0) {
    const averageRating =
      reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;

    await tx.host.update({
      where: { id: hostId },
      data: {
        averageRating: averageRating,
        totalReviews: reviews.length,
      },
    });
  }
};

const getAllReviews = async (params: any, options: IOptions) => {
  const { page, limit, skip, sortBy, sortOrder } =
    paginationHelper.calculatePagination(options);
  const { searchTerm, minRating, maxRating, ...filterData } = params;

  const andConditions: Prisma.ReviewWhereInput[] = [{ isDeleted: false }];

  // Search term filter
  if (searchTerm) {
    andConditions.push({
      OR: [
        {
          comment: {
            contains: searchTerm,
            mode: "insensitive",
          },
        },
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

  // Rating range filter
  if (minRating !== undefined || maxRating !== undefined) {
    const ratingCondition: any = {};
    if (minRating !== undefined) ratingCondition.gte = Number(minRating);
    if (maxRating !== undefined) ratingCondition.lte = Number(maxRating);
    andConditions.push({ rating: ratingCondition });
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

  const whereConditions: Prisma.ReviewWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  const result = await prisma.review.findMany({
    skip,
    take: limit,
    where: whereConditions,
    orderBy: {
      [sortBy]: sortOrder,
    },
    include: {
      ...reviewPopulateFields,
    },
  });

  const total = await prisma.review.count({
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

const getTourReviews = async (
  tourId: string,
  params: any,
  options: IOptions
) => {
  const { page, limit, skip, sortBy, sortOrder } =
    paginationHelper.calculatePagination(options);
  const { minRating, maxRating } = params;

  const andConditions: Prisma.ReviewWhereInput[] = [
    { tourId },
    { isDeleted: false },
    { isApproved: true },
  ];

  // Rating range filter
  if (minRating !== undefined || maxRating !== undefined) {
    const ratingCondition: any = {};
    if (minRating !== undefined) ratingCondition.gte = Number(minRating);
    if (maxRating !== undefined) ratingCondition.lte = Number(maxRating);
    andConditions.push({ rating: ratingCondition });
  }

  const whereConditions: Prisma.ReviewWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  const result = await prisma.review.findMany({
    skip,
    take: limit,
    where: whereConditions,
    orderBy: {
      [sortBy]: sortOrder,
    },
    include: {
      tourist: {
        select: {
          id: true,
          name: true,
          profilePhoto: true,
        },
      },
      booking: {
        select: {
          bookingDate: true,
          numberOfPeople: true,
        },
      },
    },
  });

  const total = await prisma.review.count({
    where: whereConditions,
  });

  // Calculate average rating
  const reviews = await prisma.review.findMany({
    where: whereConditions,
    select: {
      rating: true,
    },
  });

  const averageRating =
    reviews.length > 0
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
      : 0;

  // Calculate rating distribution
  const ratingDistribution = {
    1: reviews.filter((r) => r.rating === 1).length,
    2: reviews.filter((r) => r.rating === 2).length,
    3: reviews.filter((r) => r.rating === 3).length,
    4: reviews.filter((r) => r.rating === 4).length,
    5: reviews.filter((r) => r.rating === 5).length,
  };

  return {
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    data: {
      reviews: result,
      summary: {
        averageRating,
        totalReviews: total,
        ratingDistribution,
      },
    },
  };
};

const getHostReviews = async (
  hostId: string,
  params: any,
  options: IOptions
) => {
  const { page, limit, skip, sortBy, sortOrder } =
    paginationHelper.calculatePagination(options);
  const { minRating, maxRating } = params;

  const andConditions: Prisma.ReviewWhereInput[] = [
    { hostId },
    { isDeleted: false },
    { isApproved: true },
  ];

  // Rating range filter
  if (minRating !== undefined || maxRating !== undefined) {
    const ratingCondition: any = {};
    if (minRating !== undefined) ratingCondition.gte = Number(minRating);
    if (maxRating !== undefined) ratingCondition.lte = Number(maxRating);
    andConditions.push({ rating: ratingCondition });
  }

  const whereConditions: Prisma.ReviewWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  const result = await prisma.review.findMany({
    skip,
    take: limit,
    where: whereConditions,
    orderBy: {
      [sortBy]: sortOrder,
    },
    include: {
      tourist: {
        select: {
          id: true,
          name: true,
          profilePhoto: true,
        },
      },
      tour: {
        select: {
          id: true,
          title: true,
          destination: true,
        },
      },
      booking: {
        select: {
          bookingDate: true,
        },
      },
    },
  });

  const total = await prisma.review.count({
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

const getMyReviews = async (req: Request, params: any, options: IOptions) => {
  const userEmail = req.user?.email;

  if (!userEmail) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, "User email not found");
  }

  const user = await prisma.user.findUnique({
    where: { email: userEmail },
    include: { tourist: true, host: true },
  });

  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
  }

  let touristId, hostId;

  if (user.tourist) {
    touristId = user.tourist.id;
  }

  if (user.host) {
    hostId = user.host.id;
  }

  const { page, limit, skip, sortBy, sortOrder } =
    paginationHelper.calculatePagination(options);
  const { searchTerm, minRating, maxRating, ...filterData } = params;

  const orConditions: Prisma.ReviewWhereInput[] = [];

  if (touristId) {
    orConditions.push({ touristId });
  }

  if (hostId) {
    orConditions.push({ hostId });
  }

  if (orConditions.length === 0) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "User is not a tourist or host"
    );
  }

  const andConditions: Prisma.ReviewWhereInput[] = [
    { OR: orConditions },
    { isDeleted: false },
  ];

  // Search term filter
  if (searchTerm) {
    andConditions.push({
      OR: [
        {
          comment: {
            contains: searchTerm,
            mode: "insensitive",
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

  // Rating range filter
  if (minRating !== undefined || maxRating !== undefined) {
    const ratingCondition: any = {};
    if (minRating !== undefined) ratingCondition.gte = Number(minRating);
    if (maxRating !== undefined) ratingCondition.lte = Number(maxRating);
    andConditions.push({ rating: ratingCondition });
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

  const whereConditions: Prisma.ReviewWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  const result = await prisma.review.findMany({
    skip,
    take: limit,
    where: whereConditions,
    orderBy: {
      [sortBy]: sortOrder,
    },
    include: {
      tourist: touristId
        ? undefined
        : {
            select: {
              id: true,
              name: true,
              profilePhoto: true,
            },
          },
      host: hostId
        ? undefined
        : {
            select: {
              id: true,
              name: true,
              profilePhoto: true,
            },
          },
      tour: {
        select: {
          id: true,
          title: true,
          destination: true,
        },
      },
      booking: {
        select: {
          bookingDate: true,
        },
      },
    },
  });

  const total = await prisma.review.count({
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

const getSingleReview = async (id: string) => {
  console.log(id, "From Service");

  const review = await prisma.review.findUnique({
    where: { id, isDeleted: false },
    include: {
      ...reviewPopulateFields,
    },
  });

  if (!review) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Review not found");
  }

  return review;
};

const updateReview = async (id: string, user: IJWTPayload, updateData: any) => {
  const review = await prisma.review.findUnique({
    where: { id, isDeleted: false },
    include: {
      tourist: true,
    },
  });

  if (!review) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Review not found");
  }

  // Authorization check
  const userData = await prisma.user.findUnique({
    where: { email: user.email },
    include: { tourist: true, admin: true },
  });

  if (!userData) {
    throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
  }

  const isAdmin = userData.role === "ADMIN";
  const isReviewOwner = userData.tourist?.id === review.touristId;

  if (!isAdmin && !isReviewOwner) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      "You are not authorized to update this review"
    );
  }

  // If admin is approving the review
  if (updateData.isApproved === true && isAdmin) {
    const result = await prisma.$transaction(async (tx) => {
      const updatedReview = await tx.review.update({
        where: { id },
        data: updateData,
        include: reviewPopulateFields,
      });

      // Update tour and host ratings when review is approved
      if (updateData.isApproved) {
        await updateTourRating(tx, review.tourId);
        await updateHostRating(tx, review.hostId);
      }

      return updatedReview;
    });

    return result;
  }

  // Regular update (by owner)
  const result = await prisma.review.update({
    where: { id },
    data: updateData,
    include: reviewPopulateFields,
  });

  return result;
};

const deleteReview = async (id: string, user: IJWTPayload) => {
  const review = await prisma.review.findUnique({
    where: { id, isDeleted: false },
    include: {
      tourist: true,
    },
  });

  if (!review) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Review not found");
  }

  // Authorization check
  const userData = await prisma.user.findUnique({
    where: { email: user.email },
    include: { tourist: true, admin: true },
  });

  if (!userData) {
    throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
  }

  const isAdmin = userData.role === "ADMIN";
  const isReviewOwner = userData.tourist?.id === review.touristId;

  if (!isAdmin && !isReviewOwner) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      "You are not authorized to delete this review"
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    // Soft delete the review
    const deletedReview = await tx.review.update({
      where: { id },
      data: {
        isDeleted: true,
      },
    });

    // Mark booking as not reviewed
    await tx.booking.update({
      where: { id: review.bookingId },
      data: {
        isReviewed: false,
      },
    });

    // Update tour and host ratings
    await updateTourRating(tx, review.tourId);
    await updateHostRating(tx, review.hostId);

    return deletedReview;
  });

  return result;
};

const getReviewStats = async (hostId?: string, touristId?: string) => {
  let whereCondition: Prisma.ReviewWhereInput = {
    isDeleted: false,
    isApproved: true,
  };

  if (hostId) {
    whereCondition.hostId = hostId;
  }

  if (touristId) {
    whereCondition.touristId = touristId;
  }

  const reviews = await prisma.review.findMany({
    where: whereCondition,
    select: {
      rating: true,
      createdAt: true,
      tour: {
        select: {
          title: true,
        },
      },
      tourist: touristId
        ? undefined
        : {
            select: {
              name: true,
            },
          },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 10,
  });

  const totalReviews = await prisma.review.count({
    where: whereCondition,
  });

  const averageRating =
    reviews.length > 0
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
      : 0;

  const ratingDistribution = {
    1: reviews.filter((r) => r.rating === 1).length,
    2: reviews.filter((r) => r.rating === 2).length,
    3: reviews.filter((r) => r.rating === 3).length,
    4: reviews.filter((r) => r.rating === 4).length,
    5: reviews.filter((r) => r.rating === 5).length,
  };

  const recentReviews = reviews.map((review) => ({
    rating: review.rating,
    createdAt: review.createdAt,
    tourTitle: review.tour?.title,
    touristName: review.tourist?.name,
  }));

  return {
    totalReviews,
    averageRating,
    ratingDistribution,
    recentReviews,
  };
};

export const ReviewService = {
  createReview,
  getAllReviews,
  getTourReviews,
  getHostReviews,
  getMyReviews,
  getSingleReview,
  updateReview,
  deleteReview,
  getReviewStats,
};
