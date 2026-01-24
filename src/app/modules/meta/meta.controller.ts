import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import catchAsync from "../../shared/catchAsync";
import sendResponse from "../../shared/sendResponse";
import { MetaService } from "./meta.service";

const getDashboardMetaData = catchAsync(async (req: Request, res: Response) => {
    const result = await MetaService.getDashboardMetaData();

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "Dashboard metadata fetched successfully",
        data: result,
    });
});

export const MetaController = {
    getDashboardMetaData,
};
