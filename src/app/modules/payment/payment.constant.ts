
export const paymentSearchableFields = [
  "transactionId",
  "description",
  "paymentMethod",
];

export const paymentFilterableFields = []; // Remove all filterable fields

export const paymentPopulateFields = {
  user: {
    select: {
      id: true,
      email: true,
      role: true,
    },
  },
  booking: {
    select: {
      id: true,
      status: true,
      paymentStatus: true,
      numberOfPeople: true,
      totalAmount: true,
      tour: {
        select: {
          id: true,
          title: true,
          destination: true,
          host: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  },
};
