
import express from "express";
import auth from "../../middlewares/auth";
import { UserRole } from "@prisma/client";
import { PaymentController } from "./payment.controller";

const router = express.Router();

// Get user payment history (TOURIST only)
router.get(
  "/user/history",
  auth(UserRole.TOURIST),
  PaymentController.getUserPayments
);

// Get host earnings (HOST only)
router.get(
  "/host/earnings",
  auth(UserRole.HOST),
  PaymentController.getHostEarnings
);

// Get all payments (ADMIN only)
router.get(
  "/",
  auth(UserRole.ADMIN),
  PaymentController.getAllPayments
);

export const paymentRoutes = router;
