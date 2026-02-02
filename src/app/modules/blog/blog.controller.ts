import { Request, Response } from "express";
import catchAsync from "../../shared/catchAsync";
import sendResponse from "../../shared/sendResponse";
import httpStatus from "http-status";
import { BlogService } from "./blog.service";
import { blogFilterableFields } from "./blog.constant";
import pick from "../../helper/pick";
import { IJWTPayload } from "../../types/common";

const createBlog = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IJWTPayload;
  const result = await BlogService.createBlog(user, req);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Blog created successfully!",
    data: result,
  });
});

const getAllBlogs = catchAsync(async (req: Request, res: Response) => {
  const filters = pick(req.query, blogFilterableFields);
  const options = pick(req.query, ["page", "limit", "sortBy", "sortOrder"]);

  // If admin is requesting, show all blogs including drafts and unapproved ones
  const isAdmin = req.user?.role === "ADMIN";
  if (isAdmin) {
    delete filters.status;
    filters.isAdminView = "true";
  }

  const result = await BlogService.getAllBlogs(filters, options);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Blogs retrieved successfully!",
    meta: result.meta,
    data: result.data,
  });
});

const getBlogById = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await BlogService.getBlogById(id as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Blog retrieved successfully!",
    data: result,
  });
});

const updateBlog = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IJWTPayload;
  const { id } = req.params;
  const result = await BlogService.updateBlog(user, id as string, req);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Blog updated successfully!",
    data: result,
  });
});

const deleteBlog = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IJWTPayload;
  const { id } = req.params;
  const result = await BlogService.deleteBlog(user, id as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Blog deleted successfully!",
    data: result,
  });
});

const createComment = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IJWTPayload;
  const { blogId } = req.params;
  const result = await BlogService.createComment(user, blogId as string, req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Comment added successfully!",
    data: result,
  });
});

const updateComment = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IJWTPayload;
  const { commentId } = req.params;
  const result = await BlogService.updateComment(user, commentId as string, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Comment updated successfully!",
    data: result,
  });
});

const deleteComment = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IJWTPayload;
  const { commentId } = req.params;
  const result = await BlogService.deleteComment(user, commentId as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Comment deleted successfully!",
    data: result,
  });
});

const toggleLike = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IJWTPayload;
  // console.log(req.user);

  const { blogId } = req.params;
  const result = await BlogService.toggleLike(user, blogId as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.liked ? "Blog liked!" : "Blog unliked!",
    data: result,
  });
});

const toggleCommentLike = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IJWTPayload;
  const { commentId } = req.params;
  const result = await BlogService.toggleCommentLike(user, commentId as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.liked ? "Comment liked!" : "Comment unliked!",
    data: result,
  });
});

const getMyBlogs = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IJWTPayload;
  const result = await BlogService.getMyBlogs(user);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "My blogs retrieved successfully!",
    data: result,
  });
});

const updateBlogStatus = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { isApproved } = req.body;
  const result = await BlogService.updateBlogStatus(id as string, isApproved);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: `Blog ${isApproved ? 'approved' : 'hidden'} successfully!`,
    data: result,
  });
});

export const BlogController = {
  createBlog,
  getAllBlogs,
  getBlogById,
  updateBlog,
  deleteBlog,
  createComment,
  updateComment,
  deleteComment,
  toggleLike,
  toggleCommentLike,
  getMyBlogs,
  updateBlogStatus,
};