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

export type ReviewFilters = {
  searchTerm?: string;
  rating?: number;
  hostId?: string;
  touristId?: string;
  tourId?: string;
  minRating?: number;
  maxRating?: number;
  isApproved?: boolean;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
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
  recentReviews: any[];
};