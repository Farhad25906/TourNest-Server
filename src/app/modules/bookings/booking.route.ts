import express, { NextFunction, Request, Response } from "express";
import auth from "../../middlewares/auth";
import { UserRole } from "@prisma/client";
import { BookingValidation } from "./booking.validation";
import { BookingController } from "./booking.controller";
import { checkBookingAvailability } from "../../middlewares/booking.middleware";

const router = express.Router();

// Create a new booking (TOURIST only)
router.post(
  "/",
  auth(UserRole.TOURIST),
  checkBookingAvailability,
  (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = BookingValidation.createBookingValidationSchema.parse(
        req.body
      );
      return BookingController.createBooking(req, res, next);
    } catch (error) {
      return next(error);
    }
  }
);

// Get all bookings (ADMIN only)
router.get(
  "/",
  auth(UserRole.ADMIN),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      // Parse query params before validation
      const query = req.query as any;
      if (query.page) query.page = Number(query.page);
      if (query.limit) query.limit = Number(query.limit);
      if (query.minPrice) query.minPrice = Number(query.minPrice);
      if (query.maxPrice) query.maxPrice = Number(query.maxPrice);
      
      // Handle array values - take only the first value if it's an array
      Object.keys(query).forEach(key => {
        if (Array.isArray(query[key]) && query[key].length > 0) {
          query[key] = query[key][0];
        }
      });
      
      const validatedQuery =
        BookingValidation.getBookingsValidationSchema.parse(query);
      return BookingController.getAllBookings(req, res, next);
    } catch (error) {
      return next(error);
    }
  }
);

// Get my bookings (TOURIST only)
router.get(
  "/my-bookings",
  auth(UserRole.TOURIST),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      // Parse query params before validation
      const query = req.query as any;
      if (query.page) query.page = Number(query.page);
      if (query.limit) query.limit = Number(query.limit);
      if (query.minPrice) query.minPrice = Number(query.minPrice);
      if (query.maxPrice) query.maxPrice = Number(query.maxPrice);
      
      // Handle array values - take only the first value if it's an array
      Object.keys(query).forEach(key => {
        if (Array.isArray(query[key]) && query[key].length > 0) {
          query[key] = query[key][0];
        }
      });
      
      const validatedQuery =
        BookingValidation.getBookingsValidationSchema.parse(query);
      return BookingController.getMyBookings(req, res, next);
    } catch (error) {
      return next(error);
    }
  }
);

// Get host bookings (HOST only)
router.get(
  "/host/my-bookings",
  auth(UserRole.HOST),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      // Parse query params before validation
      const query = req.query as any;
      if (query.page) query.page = Number(query.page);
      if (query.limit) query.limit = Number(query.limit);
      if (query.minPrice) query.minPrice = Number(query.minPrice);
      if (query.maxPrice) query.maxPrice = Number(query.maxPrice);
      
      // Handle array values - take only the first value if it's an array
      Object.keys(query).forEach(key => {
        if (Array.isArray(query[key]) && query[key].length > 0) {
          query[key] = query[key][0];
        }
      });
      
      // const validatedQuery =
      //   BookingValidation.getBookingsValidationSchema.parse(query);
      return BookingController.getHostBookings(req, res, next);
    } catch (error) {
      return next(error);
    }
  }
);

// Get single booking
router.get(
  "/:id",
  auth(UserRole.TOURIST, UserRole.HOST, UserRole.ADMIN),
  BookingController.getSingleBooking
);

// Get booking payment info
router.get(
  "/:id/payment-info",
  auth(UserRole.TOURIST, UserRole.HOST, UserRole.ADMIN),
  BookingController.getBookingPaymentInfo
);

// Initiate booking payment
router.post(
  "/:id/initiate-payment",
  auth(UserRole.TOURIST),
  BookingController.initiateBookingPayment
);

// Update booking (USER who created it or ADMIN)
router.patch(
  "/:id",
  auth(UserRole.TOURIST, UserRole.ADMIN),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = BookingValidation.updateBookingValidationSchema.parse(
        req.body
      );
      return BookingController.updateBooking(req, res, next);
    } catch (error) {
      return next(error);
    }
  }
);

// Update booking status (HOST or ADMIN)
router.patch(
  "/:id/status",
  auth(UserRole.HOST, UserRole.ADMIN),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = BookingValidation.updateBookingStatusValidationSchema.parse(
        req.body
      );
      return BookingController.updateBookingStatus(req, res, next);
    } catch (error) {
      return next(error);
    }
  }
);

// Cancel booking (USER who created it or ADMIN)
router.patch(
  "/:id/cancel",
  auth(UserRole.TOURIST, UserRole.ADMIN),
  BookingController.cancelBooking
);

// Delete booking (ADMIN only)
router.delete("/:id", auth(UserRole.ADMIN), BookingController.deleteBooking);

// Get booking statistics (HOST or ADMIN)
router.get(
  "/host/stats",
  auth(UserRole.HOST),
  BookingController.getHostBookingStats
);

// Get user booking statistics (USER)
router.get(
  "/user/stats",
  auth(UserRole.TOURIST),
  BookingController.getUserBookingStats
);

export const bookingRoutes = router;