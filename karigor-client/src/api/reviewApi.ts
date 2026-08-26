import { apiClient } from './client';
import type { BookingDto } from './marketplaceApi';

export interface ReviewDto {
  id: number;
  bookingId: number;
  workerId: number;
  workerName: string;
  customerId: number;
  customerName: string;
  customerProfileImageUrl?: string;
  categoryName: string;
  rating: number;
  comment?: string;
  workerResponse?: string;
  bookingDate: string;
}

export interface CreateReviewDto {
  bookingId: number;
  rating: number;
  comment?: string;
}

export interface WorkerReviewResponseDto {
  response: string;
}

export interface WorkerReviewsSummaryDto {
  workerId: number;
  averageRating: number;
  totalReviews: number;
  ratingDistribution: Record<number, number>;
  reviews: ReviewDto[];
}

export const reviewApi = {
  createReview: async (data: CreateReviewDto): Promise<ReviewDto> => {
    const res = await apiClient.post<ReviewDto>('/reviews', data);
    return res.data;
  },

  getWorkerReviews: async (workerId: number): Promise<WorkerReviewsSummaryDto> => {
    const res = await apiClient.get<WorkerReviewsSummaryDto>(`/reviews/worker/${workerId}`);
    return res.data;
  },

  getBookingReview: async (bookingId: number): Promise<ReviewDto> => {
    const res = await apiClient.get<ReviewDto>(`/reviews/booking/${bookingId}`);
    return res.data;
  },

  respondToReview: async (reviewId: number, data: WorkerReviewResponseDto): Promise<ReviewDto> => {
    const res = await apiClient.put<ReviewDto>(`/reviews/${reviewId}/response`, data);
    return res.data;
  },

  getEligibleBookings: async (): Promise<BookingDto[]> => {
    const res = await apiClient.get<BookingDto[]>('/reviews/eligible-bookings');
    return res.data;
  },
};
