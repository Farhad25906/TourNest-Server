
export const bookingSearchableFields = ["id", "status", "paymentStatus"];

export const bookingFilterableFields = [
  "searchTerm",
  "status",
  "paymentStatus",
  "userId",
  "touristId",
  "tourId",
  "minPrice",
  "maxPrice",
  "startDate",
  "endDate",
  "isReviewed",
];

export const bookingPopulateFields = {
  user: {
    select: {
      id: true,
      email: true,
      role: true,
      // name: true,
      // profilePhoto: true,
    },
  },
  tourist: {
    select: {
      id: true,
      name: true,
      email: true,
      profilePhoto: true,
      // phone: true,
    },
  },
  tour: {
    select: {
      id: true,
      title: true,
      destination: true,
      city: true,
      startDate: true,
      endDate: true,
      price: true,
      images: true,
      host: {
        select: {
          id: true,
          name: true,
          email: true,
          profilePhoto: true,
        },
      },
    },
  },
};
