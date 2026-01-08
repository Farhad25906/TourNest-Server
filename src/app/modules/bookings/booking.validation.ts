
import { z } from 'zod';
import { BookingStatus, PaymentStatus, PaymentMethod } from '@prisma/client';

const createBookingValidationSchema = z.object({
  tourId: z.string().min(1, 'Tour ID is required'),
  numberOfPeople: z.number().int().min(1, 'At least 1 person is required'),
  totalAmount: z.number().positive('Total amount must be positive'),
  specialRequests: z.string().optional(),
  paymentMethod: z.nativeEnum(PaymentMethod).optional().default('STRIPE'),
  status: z.nativeEnum(BookingStatus).optional().default('PENDING'),
  paymentStatus: z.nativeEnum(PaymentStatus).optional().default('PENDING'),
  bookingDate: z.string().transform((str) => new Date(str)).optional(),
});

const updateBookingValidationSchema = z.object({
  numberOfPeople: z.number().int().min(1, 'At least 1 participant is required').optional(),
  totalAmount: z.number().positive('Total amount must be positive').optional(),
  specialRequests: z.string().optional(),
  status: z.nativeEnum(BookingStatus).optional(),
  paymentStatus: z.nativeEnum(PaymentStatus).optional(),
  isReviewed: z.boolean().optional(),
}).partial();

const updateBookingStatusValidationSchema = z.object({
  status: z.nativeEnum(BookingStatus),
});

const getBookingsValidationSchema = z.object({
  searchTerm: z.string().optional(),
  status: z.nativeEnum(BookingStatus).optional(),
  paymentStatus: z.nativeEnum(PaymentStatus).optional(),
  minPrice: z.number().optional(),
  maxPrice: z.number().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
}).partial();

export const BookingValidation = {
  createBookingValidationSchema,
  updateBookingValidationSchema,
  updateBookingStatusValidationSchema,
  getBookingsValidationSchema
};


