// subscription.controller.ts
import { Request, Response } from 'express';
import catchAsync from '../../shared/catchAsync';
import sendResponse from '../../shared/sendResponse';
import httpStatus from 'http-status';
import { SubscriptionService } from './subscription.service';
import { subscriptionPlanFilterableFields, subscriptionFilterableFields } from './subscription.constant';
import pick from '../../helper/pick';
import { IJWTPayload } from '../../types/common';

// Host: Create subscription
const createSubscription = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IJWTPayload;
  const { planId } = req.body;
  
  const result = await SubscriptionService.createSubscription(user, planId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.message,
    data: result
  });
});

// Host: Get current subscription
const getCurrentSubscription = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IJWTPayload;
  const result = await SubscriptionService.getCurrentSubscription(user.email);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Current subscription retrieved',
    data: result
  });
});

// Host: Cancel subscription
const cancelSubscription = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IJWTPayload;
  const result = await SubscriptionService.cancelSubscription(user.email);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Subscription cancelled successfully',
    data: result
  });
});

// Admin: Initialize default plans
const initializeDefaultPlans = catchAsync(async (req: Request, res: Response) => {
  const result = await SubscriptionService.initializeDefaultPlans();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.message,
    data: result
  });
});

// Admin: Create subscription plan
const createSubscriptionPlan = catchAsync(async (req: Request, res: Response) => {
  const result = await SubscriptionService.createSubscriptionPlan(req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Subscription plan created successfully',
    data: result
  });
});

// Public & Admin: Get all subscription plans
const getAllSubscriptionPlans = catchAsync(async (req: Request, res: Response) => {
  const filters = pick(req.query, subscriptionPlanFilterableFields);
  const options = pick(req.query, ['page', 'limit', 'sortBy', 'sortOrder']);
  const result = await SubscriptionService.getAllSubscriptionPlans(filters, options);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Subscription plans retrieved successfully',
    meta: result.meta,
    data: result.data
  });
});

// Public: Get single subscription plan
const getSingleSubscriptionPlan = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await SubscriptionService.getSingleSubscriptionPlan(id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Subscription plan retrieved successfully',
    data: result
  });
});

// Admin: Update subscription plan
const updateSubscriptionPlan = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await SubscriptionService.updateSubscriptionPlan(id, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Subscription plan updated successfully',
    data: result
  });
});

// Admin: Delete subscription plan
const deleteSubscriptionPlan = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await SubscriptionService.deleteSubscriptionPlan(id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Subscription plan deleted successfully',
    data: result
  });
});

// Admin: Get all subscriptions
const getAllSubscriptions = catchAsync(async (req: Request, res: Response) => {
  const filters = pick(req.query, subscriptionFilterableFields);
  const options = pick(req.query, ['page', 'limit', 'sortBy', 'sortOrder']);
  const result = await SubscriptionService.getAllSubscriptions(filters, options);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Subscriptions retrieved successfully',
    meta: result.meta,
    data: result.data
  });
});

// Admin: Get subscription details
const getSubscriptionDetails = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await SubscriptionService.getSubscriptionDetails(id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Subscription details retrieved successfully',
    data: result
  });
});

// Admin: Update subscription
const updateSubscription = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await SubscriptionService.updateSubscription(id, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Subscription updated successfully',
    data: result
  });
});

// Admin: Delete subscription
const deleteSubscription = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await SubscriptionService.deleteSubscription(id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Subscription deleted successfully',
    data: result
  });
});

// Admin: Get subscription analytics
const getSubscriptionAnalytics = catchAsync(async (req: Request, res: Response) => {
  const result = await SubscriptionService.getSubscriptionAnalytics();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Subscription analytics retrieved',
    data: result
  });
});

export const SubscriptionController = {
  // Host functions
  createSubscription,
  getCurrentSubscription,
  cancelSubscription,
  
  // Plan management (Public & Admin)
  initializeDefaultPlans,
  createSubscriptionPlan,
  getAllSubscriptionPlans,
  getSingleSubscriptionPlan,
  updateSubscriptionPlan,
  deleteSubscriptionPlan,
  
  // Admin functions
  getAllSubscriptions,
  getSubscriptionDetails,
  updateSubscription,
  deleteSubscription,
  getSubscriptionAnalytics,
};