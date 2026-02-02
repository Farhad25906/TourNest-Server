// tour.controller.ts
import { Request, Response } from 'express';
import catchAsync from '../../shared/catchAsync';
import sendResponse from '../../shared/sendResponse';
import httpStatus from 'http-status';
import { TourService } from './tour.service';
import { hostTourFilterableFields, hostTourSearchableFields, } from './tour.constant';
import pick from '../../helper/pick';

const createTour = catchAsync(async (req: Request, res: Response) => {
  const result = await TourService.createTour(req);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Tour created successfully!',
    data: result
  });
});

const getAllTours = catchAsync(async (req: Request, res: Response) => {
  const filters = pick(req.query, hostTourFilterableFields);
  const options = pick(req.query, ['page', 'limit', 'sortBy', 'sortOrder']);
  const result = await TourService.getAllTours(filters, options);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Tours retrieved successfully!',
    meta: result.meta,
    data: result.data
  });
});

const getSingleTour = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await TourService.getSingleTour(id as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Tour retrieved successfully!',
    data: result
  });
});

const updateTour = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await TourService.updateTour(id as string, req);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Tour updated successfully!',
    data: result
  });
});

const deleteTour = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  // Just pass the tour ID to the service
  const result = await TourService.deleteTour(id as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Tour deleted successfully!',
    data: result
  });
});
const getHostTours = catchAsync(async (req: Request, res: Response) => {
  const filters = pick(req.query, hostTourSearchableFields);
  const options = pick(req.query, ['page', 'limit', 'sortBy', 'sortOrder']);
  const result = await TourService.getHostTours(req, filters, options);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Your tours retrieved successfully!',
    meta: result.meta,
    data: result.data
  });
});

const getHostTourStats = catchAsync(async (req: Request, res: Response) => {
  const result = await TourService.getHostTourStats(req);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Tour statistics retrieved successfully!',
    data: result
  });
});

const getHostSingleTour = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await TourService.getHostSingleTour(id as string, req);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Tour retrieved successfully!',
    data: result
  });
});

const completeTour = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await TourService.completeTour(id as string, req);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Tour completed successfully! All bookings updated.',
    data: result,
  });
});


// Update the export to include new controllers
export const TourController = {
  createTour,
  getAllTours,
  getSingleTour,
  updateTour,
  deleteTour,
  getHostTours,
  getHostTourStats,
  getHostSingleTour,
  completeTour
};