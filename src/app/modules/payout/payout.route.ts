import express from "express";
import auth from "../../middlewares/auth";
import { UserRole } from "@prisma/client";
import { PayoutController } from "./payout.controller";

const router = express.Router();

// Request a payout (HOST only)
router.post(
    "/request",
    auth(UserRole.HOST),
    PayoutController.requestPayout
);

// Get host payout history (HOST only)
router.get(
    "/my-payouts",
    auth(UserRole.HOST),
    PayoutController.getHostPayouts
);

// Get host payout statistics (HOST only)
router.get(
    "/stats",
    auth(UserRole.HOST),
    PayoutController.getPayoutStats
);

export const payoutRoutes = router;
