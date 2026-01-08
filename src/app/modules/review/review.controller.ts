// review.controller.ts
import { Request, Response } from "express";
import catchAsync from "../../shared/catchAsync";
import sendResponse from "../../shared/sendResponse";
import httpStatus from "http-status";
import pick from "../../helper/pick";
import { ReviewService } from "./review.service";
import { reviewFilterableFields } from "./review.constant";

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
  const filters = pick(req.query, reviewFilterableFields);
  const options = pick(req.query, ["page", "limit", "sortBy", "sortOrder"]);
  const result = await ReviewService.getAllReviews(filters, options);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Reviews retrieved successfully!",
    meta: result.meta,
    data: result.data,
  });
});

const getTourReviews = catchAsync(async (req: Request, res: Response) => {
  const { tourId } = req.params;
  const filters = pick(req.query, ["minRating", "maxRating"]);
  const options = pick(req.query, ["page", "limit", "sortBy", "sortOrder"]);
  const result = await ReviewService.getTourReviews(tourId, filters, options);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Tour reviews retrieved successfully!",
    meta: result.meta,
    data: result.data,
  });
});

const getHostReviews = catchAsync(async (req: Request, res: Response) => {
  const { hostId } = req.params;
  const filters = pick(req.query, ["minRating", "maxRating"]);
  const options = pick(req.query, ["page", "limit", "sortBy", "sortOrder"]);
  const result = await ReviewService.getHostReviews(hostId, filters, options);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Host reviews retrieved successfully!",
    meta: result.meta,
    data: result.data,
  });
});

const getMyReviews = catchAsync(async (req: Request, res: Response) => {
  const filters = pick(req.query, reviewFilterableFields);
  const options = pick(req.query, ["page", "limit", "sortBy", "sortOrder"]);
  const result = await ReviewService.getMyReviews(req, filters, options);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Your reviews retrieved successfully!",
    meta: result.meta,
    data: result.data,
  });
});

const getSingleReview = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await ReviewService.getSingleReview(id);

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
  const result = await ReviewService.updateReview(id, user, req.body);

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
  const result = await ReviewService.deleteReview(id, user);

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