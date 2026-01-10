// review.route.ts
import express, { NextFunction, Request, Response } from "express";
import auth from "../../middlewares/auth";
import { UserRole } from "@prisma/client";
import { ReviewValidation } from "./review.validation";
import { ReviewController } from "./review.controller";

const router = express.Router();

// Create a new review (TOURIST only)
router.post(
  "/",
  auth(UserRole.TOURIST),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = ReviewValidation.createReviewValidationSchema.parse(req.body);
      return ReviewController.createReview(req, res, next);
    } catch (error) {
      return next(error);
    }
  }
);

// Get all reviews (ADMIN only)
router.get("/", auth(UserRole.ADMIN), ReviewController.getAllReviews);

// Get tour reviews (Public)
router.get("/tour/:tourId", ReviewController.getTourReviews);

// Get host reviews (Public)
router.get("/host/:hostId", ReviewController.getHostReviews);

// Get my reviews (TOURIST or HOST)
router.get(
  "/my-reviews",
  auth(UserRole.TOURIST, UserRole.HOST),
  ReviewController.getMyReviews
);

// Get single review (Public)
router.get("/:id", ReviewController.getSingleReview);

// Update review (Review owner or ADMIN)
router.patch(
  "/:id",
  auth(UserRole.TOURIST, UserRole.ADMIN),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = ReviewValidation.updateReviewValidationSchema.parse(req.body);
      return ReviewController.updateReview(req, res, next);
    } catch (error) {
      return next(error);
    }
  }
);

// Delete review (Review owner or ADMIN)
router.delete(
  "/:id",
  auth(UserRole.TOURIST, UserRole.ADMIN),
  ReviewController.deleteReview
);

// Get review statistics (Public)
router.get("/stats/summary", ReviewController.getReviewStats);

export const reviewRoutes = router;