import { BookingStatus } from "@prisma/client";

export type CreateBookingInput = {
  tourId: string;
  userId: string;
  bookingDate: Date;
  participants: number;
  totalPrice: number;
  specialRequests?: string;
  status?: BookingStatus;
};

export type UpdateBookingInput = {
  participants?: number;
  totalPrice?: number;
  specialRequests?: string;
  status?: BookingStatus;
};

export type BookingFilters = {
  searchTerm?: string;
  status?: BookingStatus;
  userId?: string;
  hostId?: string;
  tourId?: string;
  minPrice?: number;
  maxPrice?: number;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
};

export type BookingStats = {
  totalBookings: number;
  confirmedBookings: number;
  pendingBookings: number;
  cancelledBookings: number;
  totalRevenue: number;
  bookingsByMonth: Record<string, number>;
  recentBookings: any[];
};