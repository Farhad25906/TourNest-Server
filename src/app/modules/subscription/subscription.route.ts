// subscription.route.ts
import express, { NextFunction, Request, Response } from 'express';
import { SubscriptionController } from './subscription.controller';
import { 
  createSubscriptionPlanValidationSchema,
  updateSubscriptionPlanValidationSchema,
  createSubscriptionValidationSchema,
  updateSubscriptionValidationSchema 
} from './subscription.validation';
import auth from '../../middlewares/auth';
import { UserRole } from '@prisma/client';

const router = express.Router();

// Public routes
router.get('/plans', SubscriptionController.getAllSubscriptionPlans);
router.get('/plans/:id', SubscriptionController.getSingleSubscriptionPlan);

// Host routes
router.post(
  '/subscribe',
  auth(UserRole.HOST),
  (req: Request, res: Response, next: NextFunction) => {
    req.body = createSubscriptionValidationSchema.parse(req.body);
    return SubscriptionController.createSubscription(req, res, next);
  }
);

router.get(
  '/my-subscription',
  auth(UserRole.HOST),
  SubscriptionController.getCurrentSubscription
);

router.post(
  '/cancel',
  auth(UserRole.HOST),
  SubscriptionController.cancelSubscription
);

// Admin routes
router.post(
  '/initialize-plans',
  auth(UserRole.ADMIN),
  SubscriptionController.initializeDefaultPlans
);

router.post(
  '/create-plan',
  auth(UserRole.ADMIN),
  (req: Request, res: Response, next: NextFunction) => {
    req.body = createSubscriptionPlanValidationSchema.parse(req.body);
    return SubscriptionController.createSubscriptionPlan(req, res, next);
  }
);

router.patch(
  '/plans/:id',
  auth(UserRole.ADMIN),
  (req: Request, res: Response, next: NextFunction) => {
    req.body = updateSubscriptionPlanValidationSchema.parse(req.body);
    return SubscriptionController.updateSubscriptionPlan(req, res, next);
  }
);

router.delete(
  '/plans/:id',
  auth(UserRole.ADMIN),
  SubscriptionController.deleteSubscriptionPlan
);



router.get(
  '/:id',
  auth(UserRole.ADMIN),
  SubscriptionController.getSubscriptionDetails
);

router.patch(
  '/:id',
  auth(UserRole.ADMIN),
  (req: Request, res: Response, next: NextFunction) => {
    req.body = updateSubscriptionValidationSchema.parse(req.body);
    return SubscriptionController.updateSubscription(req, res, next);
  }
);

router.delete(
  '/:id',
  auth(UserRole.ADMIN),
  SubscriptionController.deleteSubscription
);

router.get(
  '/analytics/overview',
  auth(UserRole.ADMIN),
  SubscriptionController.getSubscriptionAnalytics
);

export const subscriptionRoutes = router;