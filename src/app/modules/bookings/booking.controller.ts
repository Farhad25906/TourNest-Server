import { Request, Response } from "express";
import catchAsync from "../../shared/catchAsync";
import sendResponse from "../../shared/sendResponse";
import httpStatus from "http-status";
import pick from "../../helper/pick";
import { BookingService } from "./booking.service";
import { bookingFilterableFields } from "./booking.constant";
import ApiError from "../../errors/ApiError";

const createBooking = catchAsync(async (req: Request, res: Response) => {
  const result = await BookingService.createBooking(req);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Booking created successfully!",
    data: result,
  });
});

const getAllBookings = catchAsync(async (req: Request, res: Response) => {
  const filters = pick(req.query, bookingFilterableFields);
  const options = pick(req.query, ["page", "limit", "sortBy", "sortOrder"]);
  const result = await BookingService.getAllBookings(filters, options);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Bookings retrieved successfully!",
    meta: result.meta,
    data: result.data,
  });
});

const getMyBookings = catchAsync(async (req: Request, res: Response) => {
  const filters = pick(req.query, bookingFilterableFields);
  const options = pick(req.query, ["page", "limit", "sortBy", "sortOrder"]);
  const result = await BookingService.getMyBookings(req, filters, options);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Your bookings retrieved successfully!",
    meta: result.meta,
    data: result.data,
  });
});

const getHostBookings = catchAsync(async (req: Request, res: Response) => {
  const filters = pick(req.query, bookingFilterableFields);
  const options = pick(req.query, ["page", "limit", "sortBy", "sortOrder"]);
  const result = await BookingService.getHostBookings(req, filters, options);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Host bookings retrieved successfully!",
    meta: result.meta,
    data: result.data,
  });
});

const getSingleBooking = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user;
  const result = await BookingService.getSingleBooking(id, user);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Booking retrieved successfully!",
    data: result,
  });
});

const updateBooking = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user;
  const result = await BookingService.updateBooking(id, user, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Booking updated successfully!",
    data: result,
  });
});

const updateBookingStatus = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user;
  const result = await BookingService.updateBookingStatus(id, user, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Booking status updated successfully!",
    data: result,
  });
});

const cancelBooking = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user;
  const result = await BookingService.cancelBooking(id, user);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Booking cancelled successfully!",
    data: result,
  });
});

const deleteBooking = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await BookingService.deleteBooking(id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Booking deleted successfully!",
    data: result,
  });
});

const getHostBookingStats = catchAsync(async (req: Request, res: Response) => {
  const result = await BookingService.getHostBookingStats(req);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Booking statistics retrieved successfully!",
    data: result,
  });
});

const getUserBookingStats = catchAsync(async (req: Request, res: Response) => {
  const result = await BookingService.getUserBookingStats(req);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Your booking statistics retrieved successfully!",
    data: result,
  });
});

const getBookingPaymentInfo = catchAsync(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = req.user;
    const result = await BookingService.getBookingPaymentInfo(id, user.id);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Booking payment info retrieved successfully!",
      data: result,
    });
  }
);

const initiateBookingPayment = catchAsync(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const userEmail = req.user?.email;
    if (!userEmail) {
      throw new ApiError(httpStatus.UNAUTHORIZED, "User email not found");
    }
    console.log("Hello I am Doing Payment");
    
    
    // This returns { paymentUrl, sessionId, paymentId }
    const result = await BookingService.initiateBookingPayment(id, userEmail);

    console.log("From Booking Controller:", result);
    
    if (!result) {
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR, 
        "Failed to initiate payment. No result returned."
      );
    }

    // If there's a paymentUrl, send it directly
    if (result.paymentUrl) {
      return sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Payment initiated successfully!",
        data: {
          paymentUrl: result.paymentUrl,
          sessionId: result.sessionId,
          paymentId: result.paymentId
        },
      });
    }

    // Fallback - return whatever result we have
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Payment initiated successfully!",
      data: result,
    });
  }
);


export const BookingController = {
  createBooking,
  getAllBookings,
  getMyBookings,
  getHostBookings,
  getSingleBooking,
  updateBooking,
  updateBookingStatus,
  cancelBooking,
  deleteBooking,
  getHostBookingStats,
  getUserBookingStats,
  getBookingPaymentInfo,
  initiateBookingPayment,
};
