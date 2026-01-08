// review.constant.ts
export const reviewSearchableFields = ["id", "comment"];

export const reviewFilterableFields = [
  "searchTerm",
  "rating",
  "hostId",
  "touristId",
  "tourId",
  "isApproved",
  "minRating",
  "maxRating",
];

export const reviewPopulateFields = {
  booking: {
    select: {
      id: true,
      bookingDate: true,
      numberOfPeople: true,
      totalAmount: true,
    },
  },
  host: {
    select: {
      id: true,
      name: true,
      profilePhoto: true,
    },
  },
  tourist: {
    select: {
      id: true,
      name: true,
      profilePhoto: true,
    },
  },
  tour: {
    select: {
      id: true,
      title: true,
      destination: true,
      images: true,
    },
  },
};