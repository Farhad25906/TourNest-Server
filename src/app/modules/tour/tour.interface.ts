import { DifficultyLevel, TourCategory } from "@prisma/client";

// tour.interface.ts - Add these interfaces
export type HostTourFilters = {
  searchTerm?: string;
  destination?: string;
  city?: string;
  country?: string;
  category?: TourCategory;
  difficulty?: DifficultyLevel;
  minPrice?: number;
  maxPrice?: number;
  startDate?: Date;
  endDate?: Date;
  isActive?: boolean;
  isFeatured?: boolean;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
};

export type HostTourStats = {
  totalTours: number;
  activeTours: number;
  featuredTours: number;
  totalViews: number;
  upcomingTours: number;
  pastTours: number;
  toursByCategory: Record<string, number>;
  toursByStatus: {
    active: number;
    inactive: number;
    featured: number;
  };
};