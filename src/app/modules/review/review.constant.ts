// review.constant.ts
export const reviewPopulateFields = {
  booking: {
    select: {
      id: true,
      bookingDate: true,
      numberOfPeople: true,
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
    },
  },
};