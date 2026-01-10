// review.interface.ts
export type CreateReviewInput = {
  bookingId: string;
  rating: number;
  comment?: string;
};

export type UpdateReviewInput = {
  rating?: number;
  comment?: string;
  isApproved?: boolean;
};

export type ReviewStats = {
  totalReviews: number;
  averageRating: number;
  ratingDistribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
};