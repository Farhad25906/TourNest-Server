import { Request } from "express";

import bcrypt from "bcryptjs";

import { fileUploader } from "../../helper/fileUploader";

import { IOptions, paginationHelper } from "../../helper/paginationHelper";
import { userSearchableFields } from "./user.constant";
import { IJWTPayload } from "../../types/common";

import { Admin, Host, Prisma, UserRole, UserStatus } from "@prisma/client";
import envVars from "../../config/env";
import { prisma } from "../../shared/prisma";

const createTourist = async (req: Request) => {
  if (req.file) {
    const uploadResult = await fileUploader.uploadToCloudinary(req.file);
    req.body.tourist.profilePhoto = uploadResult?.secure_url;
  }

  const hashPassword = await bcrypt.hash(
    req.body.password,
    envVars.BCRYPT_SALT_ROUND
  );

  const result = await prisma.$transaction(async (tnx) => {
    await tnx.user.create({
      data: {
        email: req.body.tourist.email,
        password: hashPassword,
        role: UserRole.TOURIST, // Add role
      },
    });

    return await tnx.tourist.create({
      data: req.body.tourist,
    });
  });

  return result;
};

const createAdmin = async (req: Request): Promise<Admin> => {
  const file = req.file;

  if (file) {
    const uploadToCloudinary = await fileUploader.uploadToCloudinary(file);
    req.body.admin.profilePhoto = uploadToCloudinary?.secure_url;
  }

  const hashedPassword: string = await bcrypt.hash(
    req.body.password,
    envVars.BCRYPT_SALT_ROUND
  );

  const userData = {
    email: req.body.admin.email,
    password: hashedPassword,
    role: UserRole.ADMIN,
  };

  const result = await prisma.$transaction(async (transactionClient) => {
    await transactionClient.user.create({
      data: userData,
    });

    const createdAdminData = await transactionClient.admin.create({
      data: req.body.admin,
    });

    return createdAdminData;
  });

  return result;
};

// user.service.ts - Update createHosts function
const createHosts = async (req: Request): Promise<Host> => {
  const file = req.file;

  if (file) {
    const uploadToCloudinary = await fileUploader.uploadToCloudinary(file);
    req.body.host.profilePhoto = uploadToCloudinary?.secure_url;
  }

  const hashedPassword: string = await bcrypt.hash(
    req.body.password,
    envVars.BCRYPT_SALT_ROUND
  );

  const userData = {
    email: req.body.host.email,
    password: hashedPassword,
    role: UserRole.HOST,
  };

  const result = await prisma.$transaction(async (transactionClient) => {
    await transactionClient.user.create({
      data: userData,
    });

    // Create host with default limits
    const createdHostData = await transactionClient.host.create({
      data: {
        ...req.body.host,
        tourLimit: 4, // Default free plan
        blogLimit: 5, // Default free plan
        currentTourCount: 0,
        currentBlogCount: 0,
      },
    });

    return createdHostData;
  });

  return result;
};

const getAllFromDB = async (params: any, options: IOptions) => {
  const { page, limit, skip, sortBy, sortOrder } =
    paginationHelper.calculatePagination(options);
  const { searchTerm, ...filterData } = params;

  const andConditions: Prisma.UserWhereInput[] = [];

  // Add default filter for non-deleted users if not specified
  if (!filterData.status) {
    andConditions.push({
      status: UserStatus.ACTIVE,
    });
  }

  if (searchTerm) {
    andConditions.push({
      OR: userSearchableFields.map((field) => ({
        [field]: {
          contains: searchTerm,
          mode: "insensitive",
        },
      })),
    });
  }

  if (Object.keys(filterData).length > 0) {
    andConditions.push({
      AND: Object.keys(filterData).map((key) => ({
        [key]: {
          equals: (filterData as any)[key],
        },
      })),
    });
  }

  const whereConditions: Prisma.UserWhereInput =
    andConditions.length > 0
      ? {
          AND: andConditions,
        }
      : {};

  // Determine which relations to include based on role if specified
  const include = {
    // Always include basic user data
    ...(filterData.role
      ? {
          // Conditionally include role-specific data based on the role filter
          admin: filterData.role === UserRole.ADMIN,
          host: filterData.role === UserRole.HOST,
          tourist: filterData.role === UserRole.TOURIST,
        }
      : {
          // If no role filter, include all related data
          admin: true,
          host: true,
          tourist: true,
        }),
  };

  const result = await prisma.user.findMany({
    skip,
    take: limit,
    where: whereConditions,
    orderBy: {
      [sortBy]: sortOrder,
    },
    include,
  });

  // Transform the result to merge role-specific data
  const transformedResult = result.map((user) => {
    const baseUser = {
      id: user.id,
      email: user.email,
      role: user.role,
      needPasswordChange: user.needPasswordChange,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    // Merge role-specific data based on the user's role
    switch (user.role) {
      case UserRole.ADMIN:
        return {
          ...baseUser,
          ...user.admin,
          type: "admin" as const,
        };
      case UserRole.HOST:
        return {
          ...baseUser,
          ...user.host,
          type: "host" as const,
        };
      case UserRole.TOURIST:
        return {
          ...baseUser,
          ...user.tourist,
          type: "tourist" as const,
        };
      default:
        return {
          ...baseUser,
          type: "user" as const,
        };
    }
  });

  const total = await prisma.user.count({
    where: whereConditions,
  });

  return {
    meta: {
      page,
      limit,
      total,
    },
    data: transformedResult,
  };
};

const getMyProfile = async (user: IJWTPayload) => {
  // First, get user with all related data using a single query
  const userWithProfile = await prisma.user.findUniqueOrThrow({
    where: {
      email: user.email,
      status: UserStatus.ACTIVE,
    },
    include: {
      admin: true,
      host: true,
      tourist: true,
    },
  });
  // console.log(userWithProfile);
  

  const { admin, host, tourist, ...userInfo } = userWithProfile;

  // Determine which profile data to use based on role
  let profileData;
  switch (userInfo.role) {
    case UserRole.ADMIN:
      profileData = admin;
      break;
    case UserRole.HOST:
      profileData = host;
      break;
    case UserRole.TOURIST:
      profileData = tourist;
      break;
  }
  // console.log(profileData,userInfo, "From Controller");
  

  return {
    ...userInfo,
    ...profileData,
  };
};
const changeProfileStatus = async (
  id: string,
  payload: { status: UserStatus }
) => {
  const userData = await prisma.user.findUniqueOrThrow({
    where: {
      id,
    },
  });

  const updateUserStatus = await prisma.user.update({
    where: {
      id,
    },
    data: payload,
  });

  return updateUserStatus;
};

const updateMyProfile = async (user: IJWTPayload, req: Request) => {
  // Get user with basic info first
  const userInfo = await prisma.user.findUniqueOrThrow({
    where: {
      email: user.email,
      status: UserStatus.ACTIVE,
    },
    select: {
      id: true,
      email: true,
      role: true,
    },
  });

  const file = req.file;
  const updateData = { ...req.body };
  // console.log(updateData);
  

  // Handle file upload
  if (file) {
    const uploadToCloudinary = await fileUploader.uploadToCloudinary(file);
    updateData.profilePhoto = uploadToCloudinary?.secure_url;
  }

  // Handle visitedLocations if it's a string (might come from form data)
  if (
    userInfo.role === UserRole.HOST &&
    typeof updateData.visitedLocations === "string"
  ) {
    try {
      updateData.visitedLocations = JSON.parse(updateData.visitedLocations);
    } catch (error) {
      updateData.visitedLocations = [];
    }
  }

  // Update profile based on role
  let profileInfo;
  switch (userInfo.role) {
    case UserRole.ADMIN:
      profileInfo = await prisma.admin.update({
        where: {
          email: userInfo.email,
        },
        data: updateData,
      });
      break;
    case UserRole.HOST:
      profileInfo = await prisma.host.update({
        where: {
          email: userInfo.email,
        },
        data: updateData,
      });
      break;
    case UserRole.TOURIST:
      profileInfo = await prisma.tourist.update({
        where: {
          email: userInfo.email,
        },
        data: updateData,
      });
      break;
  }
  // console.log(userInfo,profileInfo);
  

  // Return the updated profile with user info
  return {
    ...userInfo,
    ...profileInfo,
  };
};
const deleteUser = async (id: string) => {
  const userData = await prisma.user.findUniqueOrThrow({
    where: {
      id,
    },
  });

  const deletedUser = await prisma.user.update({
    where: {
      id,
    },
    data: {
      status: UserStatus.INACTIVE,
    },
  });

  return deletedUser;
};

export const UserService = {
  createTourist,
  createAdmin,
  createHosts,
  getAllFromDB,
  getMyProfile,
  changeProfileStatus,
  updateMyProfile,
  deleteUser,
};
