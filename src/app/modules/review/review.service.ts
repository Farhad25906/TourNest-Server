// review.service.ts
import { Request } from "express";
import { prisma } from "../../shared/prisma";
import { reviewPopulateFields } from "./review.constant";
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

  // Create review
  const newReview = await prisma.review.create({
    data: {
      bookingId,
      rating,
      comment,
      hostId: booking.tour.hostId,
      touristId: user.tourist.id,
      tourId: booking.tourId,
    },
    include: {
      ...reviewPopulateFields,
    },
  });

  // Update booking
  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      isReviewed: true,
    },
  });

  // Update tour rating
  const tourReviews = await prisma.review.findMany({
    where: {
      tourId: booking.tourId,
      isApproved: true,
      isDeleted: false,
    },
  });

  const tourAvgRating = tourReviews.length > 0
    ? tourReviews.reduce((sum, r) => sum + r.rating, 0) / tourReviews.length
    : 0;

  await prisma.tour.update({
    where: { id: booking.tourId },
    data: {
      averageRating: tourAvgRating,
      totalReviews: tourReviews.length,
    },
  });

  // Update host rating
  const hostReviews = await prisma.review.findMany({
    where: {
      hostId: booking.tour.hostId,
      isApproved: true,
      isDeleted: false,
    },
  });

  const hostAvgRating = hostReviews.length > 0
    ? hostReviews.reduce((sum, r) => sum + r.rating, 0) / hostReviews.length
    : 0;

  await prisma.host.update({
    where: { id: booking.tour.hostId },
    data: {
      averageRating: hostAvgRating,
      totalReviews: hostReviews.length,
    },
  });

  return newReview;
};

const getAllReviews = async () => {
  const reviews = await prisma.review.findMany({
    where: { isDeleted: false },
    orderBy: { createdAt: "desc" },
    include: {
      ...reviewPopulateFields,
    },
  });

  return reviews;
};

const getTourReviews = async (tourId: string) => {
  const reviews = await prisma.review.findMany({
    where: {
      tourId,
      isDeleted: false,
      isApproved: true,
    },
    orderBy: { createdAt: "desc" },
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

  // Calculate statistics
  const averageRating = reviews.length > 0
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
    : 0;

  const ratingDistribution = {
    1: reviews.filter((r) => r.rating === 1).length,
    2: reviews.filter((r) => r.rating === 2).length,
    3: reviews.filter((r) => r.rating === 3).length,
    4: reviews.filter((r) => r.rating === 4).length,
    5: reviews.filter((r) => r.rating === 5).length,
  };

  return {
    reviews,
    summary: {
      averageRating,
      totalReviews: reviews.length,
      ratingDistribution,
    },
  };
};

const getHostReviews = async (hostId: string) => {
  const reviews = await prisma.review.findMany({
    where: {
      hostId,
      isDeleted: false,
      isApproved: true,
    },
    orderBy: { createdAt: "desc" },
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

  return reviews;
};

const getMyReviews = async (req: Request) => {
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

  let whereCondition: any = { isDeleted: false };

  if (user.tourist) {
    whereCondition.touristId = user.tourist.id;
  } else if (user.host) {
    whereCondition.hostId = user.host.id;
  } else {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "User is not a tourist or host"
    );
  }

  const reviews = await prisma.review.findMany({
    where: whereCondition,
    orderBy: { createdAt: "desc" },
    include: {
      tourist: user.tourist ? undefined : {
        select: {
          id: true,
          name: true,
          profilePhoto: true,
        },
      },
      host: user.host ? undefined : {
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

  return reviews;
};

const getSingleReview = async (id: string) => {
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

  // Update the review
  const updatedReview = await prisma.review.update({
    where: { id },
    data: updateData,
    include: reviewPopulateFields,
  });

  // Update ratings if review is approved by admin
  if (updateData.isApproved === true && isAdmin) {
    // Update tour rating
    const tourReviews = await prisma.review.findMany({
      where: {
        tourId: review.tourId,
        isApproved: true,
        isDeleted: false,
      },
    });

    const tourAvgRating = tourReviews.length > 0
      ? tourReviews.reduce((sum, r) => sum + r.rating, 0) / tourReviews.length
      : 0;

    await prisma.tour.update({
      where: { id: review.tourId },
      data: {
        averageRating: tourAvgRating,
        totalReviews: tourReviews.length,
      },
    });

    // Update host rating
    const hostReviews = await prisma.review.findMany({
      where: {
        hostId: review.hostId,
        isApproved: true,
        isDeleted: false,
      },
    });

    const hostAvgRating = hostReviews.length > 0
      ? hostReviews.reduce((sum, r) => sum + r.rating, 0) / hostReviews.length
      : 0;

    await prisma.host.update({
      where: { id: review.hostId },
      data: {
        averageRating: hostAvgRating,
        totalReviews: hostReviews.length,
      },
    });
  }

  return updatedReview;
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

  // Soft delete the review
  await prisma.review.update({
    where: { id },
    data: {
      isDeleted: true,
    },
  });

  // Mark booking as not reviewed
  await prisma.booking.update({
    where: { id: review.bookingId },
    data: {
      isReviewed: false,
    },
  });

  // Update tour rating
  const tourReviews = await prisma.review.findMany({
    where: {
      tourId: review.tourId,
      isApproved: true,
      isDeleted: false,
    },
  });

  const tourAvgRating = tourReviews.length > 0
    ? tourReviews.reduce((sum, r) => sum + r.rating, 0) / tourReviews.length
    : 0;

  await prisma.tour.update({
    where: { id: review.tourId },
    data: {
      averageRating: tourAvgRating,
      totalReviews: tourReviews.length,
    },
  });

  // Update host rating
  const hostReviews = await prisma.review.findMany({
    where: {
      hostId: review.hostId,
      isApproved: true,
      isDeleted: false,
    },
  });

  const hostAvgRating = hostReviews.length > 0
    ? hostReviews.reduce((sum, r) => sum + r.rating, 0) / hostReviews.length
    : 0;

  await prisma.host.update({
    where: { id: review.hostId },
    data: {
      averageRating: hostAvgRating,
      totalReviews: hostReviews.length,
    },
  });

  return { message: "Review deleted successfully" };
};

const getReviewStats = async (hostId?: string, touristId?: string) => {
  let whereCondition: any = {
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
    },
  });

  const totalReviews = reviews.length;
  const averageRating = totalReviews > 0
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / totalReviews
    : 0;

  const ratingDistribution = {
    1: reviews.filter((r) => r.rating === 1).length,
    2: reviews.filter((r) => r.rating === 2).length,
    3: reviews.filter((r) => r.rating === 3).length,
    4: reviews.filter((r) => r.rating === 4).length,
    5: reviews.filter((r) => r.rating === 5).length,
  };

  return {
    totalReviews,
    averageRating,
    ratingDistribution,
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