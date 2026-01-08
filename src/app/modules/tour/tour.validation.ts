// tour.validation.ts
import { z } from 'zod';

const createTourValidationSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  destination: z.string().min(1, 'Destination is required'),
  city: z.string().min(1, 'City is required'),
  country: z.string().min(1, 'Country is required'),
  startDate: z.string().transform((str) => new Date(str)),
  endDate: z.string().transform((str) => new Date(str)),
  duration: z.number().int().positive('Duration must be positive'),
  price: z.number().positive('Price must be positive'),
  maxGroupSize: z.number().int().min(1, 'Max group size must be at least 1'),
  category: z.enum(['ADVENTURE', 'CULTURAL', 'BEACH', 'MOUNTAIN', 'URBAN', 'NATURE', 'FOOD', 'HISTORICAL', 'RELIGIOUS', 'LUXURY']),
  difficulty: z.enum(['EASY', 'MODERATE', 'DIFFICULT', 'EXTREME']),
  included: z.array(z.string()).optional().default([]),
  excluded: z.array(z.string()).optional().default([]),
  itinerary: z.any().optional(),
  meetingPoint: z.string().min(1, 'Meeting point is required'),
  images: z.array(z.string()).optional().default([]),
  isActive: z.boolean().optional().default(true),
  isFeatured: z.boolean().optional().default(false),
});

const updateTourValidationSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  destination: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  startDate: z.string().transform((str) => new Date(str)).optional(),
  endDate: z.string().transform((str) => new Date(str)).optional(),
  duration: z.number().int().positive('Duration must be positive').optional(),
  price: z.number().positive('Price must be positive').optional(),
  maxGroupSize: z.number().int().min(1, 'Max group size must be at least 1').optional(),
  category: z.enum(['ADVENTURE', 'CULTURAL', 'BEACH', 'MOUNTAIN', 'URBAN', 'NATURE', 'FOOD', 'HISTORICAL', 'RELIGIOUS', 'LUXURY']).optional(),
  difficulty: z.enum(['EASY', 'MODERATE', 'DIFFICULT', 'EXTREME']).optional(),
  included: z.array(z.string()).optional(),
  excluded: z.array(z.string()).optional(),
  itinerary: z.any().optional(),
  meetingPoint: z.string().optional(),
  images: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
});

export const TourValidation = {
  createTourValidationSchema,
  updateTourValidationSchema
};