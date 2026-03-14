import z from "zod";

// For creating tourist
const createTouristValidationSchema = z.object({
    password: z.string().min(6, "Password must be at least 6 characters"),
    tourist: z.object({
        name: z.string().min(1, "Name is required"),
        email: z.string().email("Invalid email address"),
        profilePhoto: z.string().optional(),
        bio: z.string().optional(),
        interests: z.string().optional(),
        location: z.string().optional(),
        // contactNumber removed - doesn't exist in Tourist model
        visitedCountries: z.string().optional(),
    })
});

// For updating tourist profile
const updateTouristValidationSchema = z.object({
    name: z.string().min(1, "Name is required").optional(),
    profilePhoto: z.string().optional(),
    bio: z.string().optional().nullable(),
    contactNumber: z.string().optional().nullable(),
    interests: z.string().optional().nullable(),
    location: z.string().optional().nullable(),
    visitedCountries: z.string().optional().nullable(),
    // Complex fields
    socialLinks: z.any().optional(),
    achievements: z.array(z.string()).optional(),
    languages: z.array(z.string()).optional(),
    emergencyContact: z.any().optional(),
    favorites: z.array(z.string()).optional(),
    preferenceSettings: z.any().optional(),
}).partial();

// For creating admin
const createAdminValidationSchema = z.object({
    password: z.string().min(6, "Password must be at least 6 characters"),
    admin: z.object({
        name: z.string().min(1, "Name is required"),
        email: z.string().email("Invalid email address"),
        profilePhoto: z.string().optional(),
        contactNumber: z.string().optional(),
    })
});

// For updating admin profile
const updateAdminValidationSchema = z.object({
    name: z.string().min(1, "Name is required").optional(),
    profilePhoto: z.string().optional(),
    contactNumber: z.string().optional(),
    socialLinks: z.any().optional(),
    preferenceSettings: z.any().optional(),
}).partial();

// For creating host - fixed to include all fields from model
const createHostValidationSchema = z.object({
    password: z.string().min(6, "Password must be at least 6 characters"),
    host: z.object({
        name: z.string().min(1, "Name is required"),
        email: z.string().email("Invalid email address"),
        profilePhoto: z.string().optional(),
        phone: z.string().optional(),
        bio: z.string().optional(),
        hometown: z.string().optional(),
        visitedLocations: z.array(z.string()).optional().default([]),
        // These are optional with defaults in the model
        isVerified: z.boolean().optional().default(false),
        tourLimit: z.number().int().min(0).optional().default(3),
        currentTourCount: z.number().int().min(0).optional().default(0),
        subscriptionId: z.string().optional(),
    })
});

// For updating host profile
const updateHostValidationSchema = z.object({
    name: z.string().min(1, "Name is required").optional(),
    profilePhoto: z.string().optional(),
    phone: z.string().optional(),
    bio: z.string().optional(),
    hometown: z.string().optional(),
    visitedLocations: z.array(z.string()).optional(),
    isVerified: z.boolean().optional(),
    tourLimit: z.number().int().min(0).optional(),
    currentTourCount: z.number().int().min(0).optional(),
    subscriptionId: z.string().optional(),
    // New fields
    socialLinks: z.any().optional(),
    achievements: z.array(z.string()).optional(),
    languages: z.array(z.string()).optional(),
    emergencyContact: z.any().optional(),
    favorites: z.array(z.string()).optional(),
    preferenceSettings: z.any().optional(),
    followerCount: z.number().int().min(0).optional(),
}).partial();

// Status update validation
const updateStatusValidationSchema = z.object({
    status: z.enum(["ACTIVE", "SUSPENDED", "INACTIVE"]),
});

export const UserValidation = {
    createTouristValidationSchema,
    updateTouristValidationSchema,
    createAdminValidationSchema,
    updateAdminValidationSchema,
    createHostValidationSchema,
    updateHostValidationSchema,
    updateStatusValidationSchema
}