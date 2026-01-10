// tour.service.ts
import { Request } from "express";
import { Tour, TourCategory, DifficultyLevel, Prisma } from "@prisma/client";
import { prisma } from "../../shared/prisma";
import { IOptions, paginationHelper } from "../../helper/paginationHelper";

import { fileUploader } from "../../helper/fileUploader";
import { hostTourSearchableFields } from "./tour.constant";

const createTour = async (req: Request): Promise<Tour> => {
  const hostEmail = req.user?.email;

  if (!hostEmail) {
    throw new Error("Host email not found");
  }

  // Check if host exists and is verified
  const host = await prisma.host.findUnique({
    where: { email: hostEmail },
    include: { user: true },
  });

  if (!host) {
    throw new Error("Host not found");
  }

  if (host.user.status !== "ACTIVE") {
    throw new Error("Host account is not active");
  }

  if (host.currentTourCount >= host.tourLimit) {
    throw new Error(
      `Tour limit reached (${host.currentTourCount}/${host.tourLimit}). Please upgrade your subscription.`
    );
  }

  // Handle image uploads if any
  let images: string[] = [];

  // Check for single file upload (using upload.single())
  if (req.file) {
    const uploadResult = await fileUploader.uploadToCloudinary(req.file);
    if (uploadResult?.secure_url) {
      images.push(uploadResult.secure_url);
    }
  }

  // Also check for multiple files (if using upload.array() in the future)
  const files = req.files as Express.Multer.File[];
  if (files && Array.isArray(files) && files.length > 0) {
    for (const file of files) {
      const uploadResult = await fileUploader.uploadToCloudinary(file);
      if (uploadResult?.secure_url) {
        images.push(uploadResult.secure_url);
      }
    }
  }

  const tourData = {
    ...req.body,
    hostId: host.id, // Use the host's ID from database
    images: images.length > 0 ? images : req.body.images || [],
    currentGroupSize: 0,
    views: 0,
  };

  const result = await prisma.$transaction(async (tx) => {
    // Create the tour
    const tour = await tx.tour.create({
      data: tourData,
    });

    // Increment host's current tour count
    await tx.host.update({
      where: { id: host.id },
      data: {
        currentTourCount: {
          increment: 1,
        },
      },
    });

    return tour;
  });

  return result;
};

// In tour.service.ts, update getAllTours function:
const getAllTours = async (params: any, options: IOptions) => {
  const { page, limit, skip, sortBy, sortOrder } =
    paginationHelper.calculatePagination(options);
  const { searchTerm, minPrice, maxPrice, startDate, endDate, ...filterData } =
    params;

  console.log("Received params:", params);
  console.log("Filter data:", filterData);
  console.log("Options:", options);

  const andConditions: Prisma.TourWhereInput[] = [];

  // Filter by active tours by default (only if not explicitly set)
  // Remove the default filter temporarily for testing
  // if (filterData.isActive === undefined) {
  //   andConditions.push({
  //     isActive: true,
  //   });
  // }

  // Search functionality
  if (searchTerm) {
    console.log("Searching for:", searchTerm);
    andConditions.push({
      OR: hostTourSearchableFields.map((field) => ({
        [field]: {
          contains: searchTerm,
          mode: "insensitive",
        },
      })),
    });
  }

  // Price range filter
  if (minPrice !== undefined || maxPrice !== undefined) {
    console.log("Price filter:", { minPrice, maxPrice });
    const priceCondition: any = {};
    if (minPrice !== undefined) priceCondition.gte = Number(minPrice);
    if (maxPrice !== undefined) priceCondition.lte = Number(maxPrice);
    andConditions.push({ price: priceCondition });
  }

  // Date range filter
  if (startDate) {
    console.log("Start date filter:", startDate);
    andConditions.push({
      startDate: {
        gte: new Date(startDate),
      },
    });
  }

  if (endDate) {
    console.log("End date filter:", endDate);
    andConditions.push({
      endDate: {
        lte: new Date(endDate),
      },
    });
  }

  // Other filters (destination, city, country, category, difficulty, isFeatured)
  if (Object.keys(filterData).length > 0) {
    console.log("Other filters:", filterData);
    const filterConditions: Prisma.TourWhereInput[] = [];

    Object.keys(filterData).forEach((key) => {
      if (filterData[key] !== undefined && filterData[key] !== "") {
        console.log(`Filter ${key}:`, filterData[key]);
        if (key === "difficulty" || key === "category") {
          filterConditions.push({
            [key]: {
              equals: filterData[key],
            },
          });
        } else if (key === "isFeatured" || key === "isActive") {
          const boolValue =
            filterData[key] === "true" || filterData[key] === true;
          console.log(`Boolean filter ${key}:`, boolValue);
          filterConditions.push({
            [key]: {
              equals: boolValue,
            },
          });
        } else {
          filterConditions.push({
            [key]: {
              contains: filterData[key],
              mode: "insensitive",
            },
          });
        }
      }
    });

    if (filterConditions.length > 0) {
      andConditions.push({
        AND: filterConditions,
      });
    }
  }

  // If no conditions, get all tours
  if (andConditions.length === 0) {
    console.log("No filters applied, getting all tours");
  }

  const whereConditions: Prisma.TourWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  console.log(
    "Final where conditions:",
    JSON.stringify(whereConditions, null, 2)
  );

  try {
    const result = await prisma.tour.findMany({
      skip,
      take: limit,
      where: whereConditions,
      orderBy: {
        [sortBy]: sortOrder,
      },
      include: {
        host: {
          select: {
            id: true,
            name: true,
            profilePhoto: true,
            bio: true,
            user: {
              select: {
                email: true,
              },
            },
          },
        },
      },
    });

    const total = await prisma.tour.count({
      where: whereConditions,
    });

    console.log(`Found ${total} tours`);
    console.log("Tours found:", result);

    return {
      meta: {
        page,
        limit,
        total,
      },
      data: result,
    };
  } catch (error) {
    console.error("Error fetching tours:", error);
    throw error;
  }
};

const getSingleTour = async (id: string) => {
  const result = await prisma.tour.findUnique({
    where: { id },
    include: {
      host: {
        select: {
          id: true,
          name: true,
          profilePhoto: true,
          bio: true,
          hometown: true,
          phone: true,
          user: {
            select: {
              email: true,
            },
          },
        },
      },
    },
  });

  if (!result) {
    throw new Error("Tour not found");
  }

  // Increment views
  await prisma.tour.update({
    where: { id },
    data: {
      views: {
        increment: 1,
      },
    },
  });

  return result;
};

const updateTour = async (id: string, req: Request): Promise<Tour> => {
  const tour = await prisma.tour.findUnique({
    where: { id },
  });

  if (!tour) {
    throw new Error("Tour not found");
  }

  // Get user email from request
  const userEmail = req.user?.email;
  if (!userEmail) {
    throw new Error("User not authenticated");
  }

  // Check if user is the host of this tour or an admin
  const user = await prisma.user.findUnique({
    where: { email: userEmail },
    select: { role: true, email: true },
  });

  if (!user) {
    throw new Error("User not found");
  }

  // Get the host to check if this is their tour
  const host = await prisma.host.findUnique({
    where: { email: userEmail },
  });

  // Check authorization: user must be admin OR the host who created the tour
  const isAdmin = user.role === "ADMIN";
  const isHostOwner = host && host.id === tour.hostId;

  if (!isAdmin && !isHostOwner) {
    throw new Error("You are not authorized to update this tour");
  }

  // Handle image uploads
  let images: string[] = [...tour.images]; // Start with existing images

  // Check for single file upload
  if (req.file) {
    const uploadResult = await fileUploader.uploadToCloudinary(req.file);
    if (uploadResult?.secure_url) {
      images.push(uploadResult.secure_url); // Add new image to existing ones
    }
  }

  // Check for multiple files
  const files = req.files as Express.Multer.File[];
  if (files && Array.isArray(files) && files.length > 0) {
    for (const file of files) {
      const uploadResult = await fileUploader.uploadToCloudinary(file);
      if (uploadResult?.secure_url) {
        images.push(uploadResult.secure_url);
      }
    }
  }

  const updateData = { ...req.body };

  // Update images if new ones were uploaded
  if ((req.file || (files && files.length > 0)) && images.length > 0) {
    updateData.images = images;
  }

  const result = await prisma.tour.update({
    where: { id },
    data: updateData,
    include: {
      host: {
        select: {
          name: true,
          profilePhoto: true,
        },
      },
    },
  });

  return result;
};

const deleteTour = async (id: string) => {
  // First check if tour exists
  const tour = await prisma.tour.findUnique({
    where: { id },
  });

  if (!tour) {
    throw new Error("Tour not found");
  }

  // Delete the tour without authentication check
  const result = await prisma.$transaction(async (tx) => {
    // Delete the tour
    const deletedTour = await tx.tour.delete({
      where: { id },
    });

    // Decrement host's current tour count
    await tx.host.update({
      where: { id: tour.hostId },
      data: {
        currentTourCount: {
          decrement: 1,
        },
      },
    });

    return deletedTour;
  });

  return result;
};

const getHostTours = async (req: Request, params: any, options: IOptions) => {
  const hostEmail = req.user?.email;

  if (!hostEmail) {
    throw new Error("Host email not found");
  }

  // Get host info
  const host = await prisma.host.findUnique({
    where: { email: hostEmail },
  });

  if (!host) {
    throw new Error("Host not found");
  }

  const { page, limit, skip, sortBy, sortOrder } =
    paginationHelper.calculatePagination(options);
  const { searchTerm, minPrice, maxPrice, startDate, endDate, ...filterData } =
    params;

  const andConditions: Prisma.TourWhereInput[] = [
    { hostId: host.id }, // Filter by current host's ID
  ];

  // Add other filters
  if (searchTerm) {
    andConditions.push({
      OR: hostTourSearchableFields.map((field) => ({
        [field]: {
          contains: searchTerm,
          mode: "insensitive",
        },
      })),
    });
  }

  // Price range filter
  if (minPrice !== undefined || maxPrice !== undefined) {
    const priceCondition: any = {};
    if (minPrice !== undefined) priceCondition.gte = Number(minPrice);
    if (maxPrice !== undefined) priceCondition.lte = Number(maxPrice);
    andConditions.push({ price: priceCondition });
  }

  // Date range filter
  if (startDate) {
    andConditions.push({
      startDate: {
        gte: new Date(startDate),
      },
    });
  }

  if (endDate) {
    andConditions.push({
      endDate: {
        lte: new Date(endDate),
      },
    });
  }

  // Other filters
  if (Object.keys(filterData).length > 0) {
    andConditions.push({
      AND: Object.keys(filterData).map((key) => ({
        [key]: {
          equals: (filterData as any)[key],
        },
      })),
    });
  }

  const whereConditions: Prisma.TourWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  const result = await prisma.tour.findMany({
    skip,
    take: limit,
    where: whereConditions,
    orderBy: {
      [sortBy]: sortOrder,
    },
    include: {
      host: {
        select: {
          id: true,
          name: true,
          profilePhoto: true,
          bio: true,
          user: {
            select: {
              email: true,
            },
          },
        },
      },
      // Include bookings count for host view
      _count: {
        select: {
          bookings: true,
        },
      },
    },
  });

  const total = await prisma.tour.count({
    where: whereConditions,
  });

  return {
    meta: {
      page,
      limit,
      total,
    },
    data: result.map((tour) => ({
      ...tour,
      bookingCount: tour._count.bookings,
    })),
  };
};

// Get host tour statistics
const getHostTourStats = async (req: Request) => {
  const hostEmail = req.user?.email;

  if (!hostEmail) {
    throw new Error("Host email not found");
  }

  // Get host info
  const host = await prisma.host.findUnique({
    where: { email: hostEmail },
  });

  if (!host) {
    throw new Error("Host not found");
  }

  // Get all host's tours
  const tours = await prisma.tour.findMany({
    where: { hostId: host.id },
    include: {
      _count: {
        select: {
          bookings: true,
        },
      },
      bookings: {
        select: {
          status: true,
        },
      },
    },
  });

  // Calculate statistics
  const now = new Date();
  const totalTours = tours.length;
  const activeTours = tours.filter((tour) => tour.isActive).length;
  const featuredTours = tours.filter((tour) => tour.isFeatured).length;
  const totalViews = tours.reduce((sum, tour) => sum + (tour.views || 0), 0);
  const upcomingTours = tours.filter(
    (tour) => new Date(tour.startDate) > now
  ).length;
  const pastTours = tours.filter((tour) => new Date(tour.endDate) < now).length;

  // Calculate total bookings
  const totalBookings = tours.reduce(
    (sum, tour) => sum + tour._count.bookings,
    0
  );

  // Calculate confirmed bookings
  const confirmedBookings = tours.reduce((sum, tour) => {
    const confirmed = tour.bookings.filter(
      (booking) => booking.status === "CONFIRMED"
    ).length;
    return sum + confirmed;
  }, 0);

  // Tours by category
  const toursByCategory = tours.reduce((acc, tour) => {
    const category = tour.category || "Uncategorized";
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Tours by status
  const toursByStatus = {
    active: activeTours,
    inactive: totalTours - activeTours,
    featured: featuredTours,
  };

  // Recent tours (last 5)
  const recentTours = tours
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .slice(0, 5)
    .map((tour) => ({
      id: tour.id,
      title: tour.title,
      createdAt: tour.createdAt,
      status: tour.isActive ? "Active" : "Inactive",
      views: tour.views,
      bookingCount: tour._count.bookings,
    }));

  // Tour performance by month (last 6 months)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const toursByMonth = await prisma.tour.groupBy({
    by: ["createdAt"],
    where: {
      hostId: host.id,
      createdAt: {
        gte: sixMonthsAgo,
      },
    },
    _count: {
      _all: true,
    },
  });

  return {
    totalTours,
    activeTours,
    featuredTours,
    totalViews,
    upcomingTours,
    pastTours,
    totalBookings,
    confirmedBookings,
    toursByCategory,
    toursByStatus,
    recentTours,
    tourLimit: host.tourLimit,
    currentTourCount: host.currentTourCount,
    tourCreationAvailable: host.currentTourCount < host.tourLimit,
  };
};

// Get single tour for host (with additional host-specific info)
const getHostSingleTour = async (id: string, req: Request) => {
  const hostEmail = req.user?.email;

  if (!hostEmail) {
    throw new Error("Host email not found");
  }

  // Get host info
  const host = await prisma.host.findUnique({
    where: { email: hostEmail },
  });

  if (!host) {
    throw new Error("Host not found");
  }

  const result = await prisma.tour.findFirst({
    where: {
      id,
      hostId: host.id,
    },
    include: {
      host: {
        select: {
          id: true,
          name: true,
          profilePhoto: true,
          bio: true,
          hometown: true,
          phone: true,
          user: {
            select: {
              email: true,
            },
          },
        },
      },
      bookings: {
        select: {
          id: true,
          userId: true,
          status: true,
          bookingDate: true,
          totalAmount: true,
          user: {
            select: {
              email: true,
              // profilePhoto: true,
            },
          },
        },
        orderBy: {
          bookingDate: "desc",
        },
      },
      _count: {
        select: {
          bookings: true,
        },
      },
    },
  });

  if (!result) {
    throw new Error("Tour not found or you don't have permission to view it");
  }

  // Calculate booking statistics for this tour
  const bookingStats = {
    total: result._count.bookings,
    confirmed: result.bookings.filter((b) => b.status === "CONFIRMED").length,
    pending: result.bookings.filter((b) => b.status === "PENDING").length,
    cancelled: result.bookings.filter((b) => b.status === "CANCELLED").length,
  };

  // Don't increment views for host view (only for public view)
  return {
    ...result,
    bookingStats,
  };
};
const completeTour = async (id: string, req: Request): Promise<Tour> => {
  const tour = await prisma.tour.findUnique({
    where: { id },
    include: {
      bookings: {
        where: {
          status: "CONFIRMED",
        },
      },
    },
  });

  if (!tour) {
    throw new Error("Tour not found");
  }

  // Authorization check (same as updateTour)
  const userEmail = req.user?.email;
  if (!userEmail) {
    throw new Error("User not authenticated");
  }

  const user = await prisma.user.findUnique({
    where: { email: userEmail },
    select: { role: true, email: true },
  });

  if (!user) {
    throw new Error("User not found");
  }

  const host = await prisma.host.findUnique({
    where: { email: userEmail },
  });

  const isAdmin = user.role === "ADMIN";
  const isHostOwner = host && host.id === tour.hostId;

  if (!isAdmin && !isHostOwner) {
    throw new Error("You are not authorized to complete this tour");
  }

  // Check if tour end date has passed
  const tourEndDate = new Date(tour.endDate);
  const currentDate = new Date();
  
  if (tourEndDate > currentDate) {
    throw new Error("Cannot complete tour before the end date");
  }

  const result = await prisma.$transaction(async (tx) => {
    // Update tour to inactive
    const updatedTour = await tx.tour.update({
      where: { id },
      data: {
        isActive: false,
      },
      include: {
        host: {
          select: {
            name: true,
            profilePhoto: true,
          },
        },
      },
    });

    // Update all confirmed bookings to COMPLETED
    if (tour.bookings.length > 0) {
      await tx.booking.updateMany({
        where: {
          tourId: id,
          status: "CONFIRMED",
        },
        data: {
          status: "COMPLETED",
        },
      });
    }

    return updatedTour;
  });

  return result;
};
// Don't forget to export these new functions at the bottom of the file:
export const TourService = {
  createTour,
  getAllTours,
  getSingleTour,
  updateTour,
  deleteTour,
  getHostTours, // Add this
  getHostTourStats, // Add this
  getHostSingleTour, // Add this
  completeTour
};
