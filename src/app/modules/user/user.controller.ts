import { Request, Response } from "express";
import catchAsync from "../../shared/catchAsync";
import sendResponse from "../../shared/sendResponse";
import httpStatus from "http-status";
import { UserService } from "./user.service";
import { userFilterableFields } from "./user.constant";
import pick from "../../helper/pick";
import { IJWTPayload } from "../../types/common";

const createTourist = catchAsync(async (req: Request, res: Response) => {
  const result = await UserService.createTourist(req);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Tourist created successfully!",
    data: result,
  });
});

const createAdmin = catchAsync(async (req: Request, res: Response) => {
  const result = await UserService.createAdmin(req);
  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Admin Created successfully!",
    data: result,
  });
});

const createHosts = catchAsync(async (req: Request, res: Response) => {
  const result = await UserService.createHosts(req);
  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Host Created successfully!",
    data: result,
  });
});

const getAllFromDB = catchAsync(async (req: Request, res: Response) => {
  const filters = pick(req.query, userFilterableFields);
  const options = pick(req.query, ["page", "limit", "sortBy", "sortOrder"]);
  const result = await UserService.getAllFromDB(filters, options);
  
  

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "User retrive successfully!",
    meta: result.meta,
    data: result.data,
  });
});

const getMyProfile = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;

  const result = await UserService.getMyProfile(user as IJWTPayload);
  console.log(result), "From Controller";

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "My profile data fetched!",
    data: result,
  });
});

const changeProfileStatus = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await UserService.changeProfileStatus(id, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User status changed successfully!",
    data: result,
  });
});

const updateMyProfile = catchAsync(
  async (req: Request & { user?: IJWTPayload }, res: Response) => {
    const user = req.user;
    const result = await UserService.updateMyProfile(user as IJWTPayload, req);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Profile updated successfully!",
      data: result,
    });
  }
);
// user.controller.ts - Add this function
const deleteUser = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await UserService.deleteUser(id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User deleted successfully!",
    data: result,
  });
});
export const UserController = {
  createTourist,
  createAdmin,
  createHosts,
  getMyProfile,
  getAllFromDB,
  changeProfileStatus,
  updateMyProfile,
  deleteUser
};
