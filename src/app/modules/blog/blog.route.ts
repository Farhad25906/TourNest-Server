import { UserRole } from "@prisma/client";
import express, { NextFunction, Request, Response } from "express";
import { BlogController } from "./blog.controller";
import { fileUploader } from "../../helper/fileUploader";
import { BlogValidation } from "./blog.validation";
import auth from "../../middlewares/auth";

const router = express.Router();

// Public routes
router.get("/", BlogController.getAllBlogs);
router.get("/:id", BlogController.getBlogById);

// Protected routes
router.post(
  "/",
  auth(UserRole.HOST),
  fileUploader.upload.single("file"),
  (req: Request, res: Response, next: NextFunction) => {
    req.body = BlogValidation.createBlogValidationSchema.parse(
      req.file ? JSON.parse(req.body.data) : req.body
    );
    return BlogController.createBlog(req, res, next);
  }
);

router.get(
  "/me/my-blogs",
  auth(UserRole.HOST),
  BlogController.getMyBlogs
);

router.patch(
  "/:id",
  auth(UserRole.HOST),
  fileUploader.upload.single("file"),
  (req: Request, res: Response, next: NextFunction) => {
    req.body = BlogValidation.updateBlogValidationSchema.parse(
      req.file ? JSON.parse(req.body.data) : req.body
    );
    return BlogController.updateBlog(req, res, next);
  }
);

router.delete(
  "/:id",
  auth(UserRole.HOST, UserRole.ADMIN),
  BlogController.deleteBlog
);

// Comments routes
router.post(
  "/:blogId/comments",
  auth(UserRole.ADMIN, UserRole.HOST, UserRole.TOURIST),
  (req: Request, res: Response, next: NextFunction) => {
    req.body = BlogValidation.createCommentValidationSchema.parse(req.body);
    return BlogController.createComment(req, res, next);
  }
);

router.patch(
  "/comments/:commentId",
  auth(UserRole.ADMIN, UserRole.HOST, UserRole.TOURIST),
  (req: Request, res: Response, next: NextFunction) => {
    req.body = BlogValidation.updateCommentValidationSchema.parse(req.body);
    return BlogController.updateComment(req, res, next);
  }
);

router.delete(
  "/comments/:commentId",
  auth(UserRole.ADMIN, UserRole.HOST, UserRole.TOURIST),
  BlogController.deleteComment
);

// Likes routes
router.post(
  "/:blogId/like",
  auth(UserRole.ADMIN, UserRole.HOST, UserRole.TOURIST),
  BlogController.toggleLike
);

router.post(
  "/comments/:commentId/like",
  auth(UserRole.ADMIN, UserRole.HOST, UserRole.TOURIST),
  BlogController.toggleCommentLike
);

export const blogRoutes = router;