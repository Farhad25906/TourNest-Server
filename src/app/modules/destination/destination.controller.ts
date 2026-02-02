import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../../shared/catchAsync';
import sendResponse from '../../shared/sendResponse';
import { DestinationService } from './destination.service';

const createDestination = catchAsync(async (req: Request, res: Response) => {
    const result = await DestinationService.createDestination(req);
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Destination created successfully',
        data: result,
    });
});

const getAllDestinations = catchAsync(async (req: Request, res: Response) => {
    const result = await DestinationService.getAllDestinations(req.query);
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Destinations fetched successfully',
        data: result,
    });
});

const getSingleDestination = catchAsync(async (req: Request, res: Response) => {
    const result = await DestinationService.getSingleDestination(req.params.id as string);
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Destination fetched successfully',
        data: result,
    });
});

const updateDestination = catchAsync(async (req: Request, res: Response) => {
    const result = await DestinationService.updateDestination(req.params.id as string, req);
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Destination updated successfully',
        data: result,
    });
});

const deleteDestination = catchAsync(async (req: Request, res: Response) => {
    const result = await DestinationService.deleteDestination(req.params.id as string);
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Destination deleted successfully',
        data: result,
    });
});

export const DestinationController = {
    createDestination,
    getAllDestinations,
    getSingleDestination,
    updateDestination,
    deleteDestination,
};
