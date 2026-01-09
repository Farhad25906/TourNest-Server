import { Request, Response } from "express";
import catchAsync from "../../shared/catchAsync";
import { PaymentService } from "./payment.service";
import sendResponse from "../../shared/sendResponse";
import { stripe } from "../../config/stripe";
import httpStatus from "http-status";

const handleStripeWebhookEvent = catchAsync(
  async (req: Request, res: Response) => {
    const sig = req.headers["stripe-signature"] as string;
    // const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
    // const webhookSecret = "whsec_ac47ba4152409aae661deca87c5fc76fd4345247757c8b4cb5250f8f8d9d7ba1"
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
    let event;
    try {
     
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
       console.error("⚠️ Webhook signature verification Success:");
    } catch (err: any) {
      console.error("⚠️ Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    await PaymentService.handleStripeWebhookEvent(event);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Webhook processed successfully",
      data: null,
    });
  }
);

// Get user payment history (TOURIST)
const getUserPayments = catchAsync(async (req: Request, res: Response) => {
  const result = await PaymentService.getUserPayments(req);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Payment history retrieved successfully!",
    data: result,
  });
});

// Get host earnings (HOST)
const getHostEarnings = catchAsync(async (req: Request, res: Response) => {
  const result = await PaymentService.getHostEarnings(req);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Earnings retrieved successfully!",
    data: result,
  });
});

// Get all payments (ADMIN)
const getAllPayments = catchAsync(async (req: Request, res: Response) => {
  const result = await PaymentService.getAllPayments();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "All payments retrieved successfully!",
    data: result,
  });
});

export const PaymentController = {
  handleStripeWebhookEvent,
  getUserPayments,
  getHostEarnings,
  getAllPayments,
};
