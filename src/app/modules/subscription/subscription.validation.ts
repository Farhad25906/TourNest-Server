// subscription.validation.ts
import z from "zod";

// Create subscription plan validation
export const createSubscriptionPlanValidationSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  description: z.string().min(1, "Description is required").max(500, "Description too long"),
  price: z.number().min(0, "Price must be at least 0"),
  duration: z.number().int().min(1, "Duration must be at least 1 month"),
  tourLimit: z.number().int().min(1, "Tour limit must be at least 1"),
  blogLimit: z.number().int().min(0).nullable(),
  features: z.array(z.string()).min(1, "At least one feature is required"),
  isActive: z.boolean().optional().default(true),
});

// Update subscription plan validation
export const updateSubscriptionPlanValidationSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long").optional(),
  description: z.string().min(1, "Description is required").max(500, "Description too long").optional(),
  price: z.number().min(0, "Price must be at least 0").optional(),
  duration: z.number().int().min(1, "Duration must be at least 1 month").optional(),
  tourLimit: z.number().int().min(1, "Tour limit must be at least 1").optional(),
  blogLimit: z.number().int().min(0).nullable().optional(),
  features: z.array(z.string()).min(1, "At least one feature is required").optional(),
  isActive: z.boolean().optional(),
}).partial();

// Create subscription validation
export const createSubscriptionValidationSchema = z.object({
  planId: z.string().min(1, "Plan ID is required"),
});

// Update subscription validation (admin)
export const updateSubscriptionValidationSchema = z.object({
  status: z.enum(["PENDING", "ACTIVE", "CANCELLED", "EXPIRED", "PAUSED"]).optional(),
  adminNotes: z.string().optional(),
  extendDays: z.number().int().min(0).optional(),
  adjustTourLimit: z.number().int().optional(),
  adjustBlogLimit: z.number().int().optional(),
  reason: z.string().optional(),
}).partial();