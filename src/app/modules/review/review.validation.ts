// review.validation.ts
import { z } from 'zod';

const createReviewValidationSchema = z.object({
  bookingId: z.string().min(1, 'Booking ID is required'),
  rating: z.number().int().min(1, 'Rating must be at least 1').max(5, 'Rating cannot exceed 5'),
  comment: z.string().min(1, 'Comment is required').max(500, 'Comment cannot exceed 500 characters'),
});

const updateReviewValidationSchema = z.object({
  rating: z.number().int().min(1).max(5).optional(),
  comment: z.string().min(1).max(500).optional(),
  isApproved: z.boolean().optional(),
}).partial();

export const ReviewValidation = {
  createReviewValidationSchema,
  updateReviewValidationSchema,
};