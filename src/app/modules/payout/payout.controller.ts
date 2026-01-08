// payout.controller.ts
import { Request, Response } from "express";
import catchAsync from "../../shared/catchAsync";
import sendResponse from "../../shared/sendResponse";
import httpStatus from "http-status";
import pick from "../../helper/pick";
import { PayoutService } from "./payout.service";

const requestPayout = catchAsync(async (req: Request, res: Response) => {
  const result = await PayoutService.requestPayout(req, req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Payout request submitted successfully!",
    data: result,
  });
});

const getHostPayouts = catchAsync(async (req: Request, res: Response) => {
  const filters = pick(req.query, ["status", "startDate", "endDate"]);
  const result = await PayoutService.getHostPayouts(req, filters);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Payouts retrieved successfully!",
    data: result,
  });
});

const getPayoutStats = catchAsync(async (req: Request, res: Response) => {
  const result = await PayoutService.getPayoutStats(req);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Payout statistics retrieved successfully!",
    data: result,
  });
});

export const PayoutController = {
  requestPayout,
  getHostPayouts,
  getPayoutStats,
};