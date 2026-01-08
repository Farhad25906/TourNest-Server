// review.validation.ts
import { z } from 'zod';

const createReviewValidationSchema = z.object({
  bookingId: z.string().min(1, 'Booking ID is required'),
  rating: z.number().int().min(1, 'Rating must be at least 1').max(5, 'Rating cannot exceed 5'),
  comment: z.string().min(1, 'Comment is required').max(1000, 'Comment cannot exceed 1000 characters'),
});

const updateReviewValidationSchema = z.object({
  rating: z.number().int().min(1).max(5).optional(),
  comment: z.string().min(1).max(1000).optional(),
  isApproved: z.boolean().optional(),
}).partial();

const getReviewsValidationSchema = z.object({
  searchTerm: z.string().optional(),
  rating: z.number().int().min(1).max(5).optional(),
  hostId: z.string().optional(),
  touristId: z.string().optional(),
  tourId: z.string().optional(),
  minRating: z.number().int().min(1).optional(),
  maxRating: z.number().int().max(5).optional(),
  isApproved: z.boolean().optional(),
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
}).partial();

export const ReviewValidation = {
  createReviewValidationSchema,
  updateReviewValidationSchema,
  getReviewsValidationSchema
};