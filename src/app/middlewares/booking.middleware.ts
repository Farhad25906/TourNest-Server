import { Request, Response, NextFunction } from 'express';
import { prisma } from '../shared/prisma';


export const checkBookingAvailability = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { tourId, participants } = req.body;
    
    // Get the tour
    const tour = await prisma.tour.findUnique({
      where: { id: tourId },
    });

    if (!tour) {
      throw new Error('Tour not found');
    }

    if (!tour.isActive) {
      throw new Error('This tour is not currently available');
    }

    // Check if tour date is in the future
    const now = new Date();
    if (new Date(tour.startDate) < now) {
      throw new Error('This tour has already started');
    }

    // Check group size availability
    const currentBookings = await prisma.booking.findMany({
      where: {
        tourId,
        status: 'CONFIRMED',
      },
    });

    const totalConfirmedParticipants = currentBookings.reduce(
      (sum, booking) => sum + booking.numberOfPeople,
      0
    );

    if (totalConfirmedParticipants + participants > tour.maxGroupSize) {
      throw new Error(
        `Only ${tour.maxGroupSize - totalConfirmedParticipants} spots available`
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};