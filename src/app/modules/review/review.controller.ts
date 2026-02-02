// review.controller.ts
import { Request, Response } from "express";
import catchAsync from "../../shared/catchAsync";
import sendResponse from "../../shared/sendResponse";
import httpStatus from "http-status";
import { ReviewService } from "./review.service";

const createReview = catchAsync(async (req: Request, res: Response) => {
  const result = await ReviewService.createReview(req);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Review created successfully!",
    data: result,
  });
});

const getAllReviews = catchAsync(async (req: Request, res: Response) => {
  const result = await ReviewService.getAllReviews();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Reviews retrieved successfully!",
    data: result,
  });
});

const getTourReviews = catchAsync(async (req: Request, res: Response) => {
  const { tourId } = req.params;
  const result = await ReviewService.getTourReviews(tourId as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Tour reviews retrieved successfully!",
    data: result,
  });
});

const getHostReviews = catchAsync(async (req: Request, res: Response) => {
  const { hostId } = req.params;
  const result = await ReviewService.getHostReviews(hostId as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Host reviews retrieved successfully!",
    data: result,
  });
});

const getMyReviews = catchAsync(async (req: Request, res: Response) => {
  const result = await ReviewService.getMyReviews(req);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Your reviews retrieved successfully!",
    data: result,
  });
});

const getSingleReview = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await ReviewService.getSingleReview(id as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Review retrieved successfully!",
    data: result,
  });
});

const updateReview = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user;
  const result = await ReviewService.updateReview(id as string, user, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Review updated successfully!",
    data: result,
  });
});

const deleteReview = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user;
  const result = await ReviewService.deleteReview(id as string, user);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Review deleted successfully!",
    data: result,
  });
});

const getReviewStats = catchAsync(async (req: Request, res: Response) => {
  const { hostId, touristId } = req.query;
  const result = await ReviewService.getReviewStats(
    hostId as string,
    touristId as string
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Review statistics retrieved successfully!",
    data: result,
  });
});

export const ReviewController = {
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