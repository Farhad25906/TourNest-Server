import { BlogCategory, BlogStatus } from "@prisma/client";
import z from "zod";



// For creating blog
const createBlogValidationSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title too long"),
  content: z.string().min(1, "Content is required"),
  excerpt: z.string().max(500, "Excerpt too long").optional(),
  coverImage: z.string().optional(),
  category: z.enum(BlogCategory),
  tourId: z.string().optional(),
});

// For updating blog
const updateBlogValidationSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title too long").optional(),
  content: z.string().min(1, "Content is required").optional(),
  excerpt: z.string().max(500, "Excerpt too long").optional(),
  coverImage: z.string().optional(),
  category: z.enum(BlogCategory).optional(),
  status: z.enum(BlogStatus).optional(),
  tourId: z.string().optional(),
}).partial();

// For creating comment
const createCommentValidationSchema = z.object({
  content: z.string().min(1, "Comment content is required").max(1000, "Comment too long"),
  parentId: z.string().optional(),
});

// For updating comment
const updateCommentValidationSchema = z.object({
  content: z.string().min(1, "Comment content is required").max(1000, "Comment too long"),
});

export const BlogValidation = {
  createBlogValidationSchema,
  updateBlogValidationSchema,
  createCommentValidationSchema,
  updateCommentValidationSchema,
};