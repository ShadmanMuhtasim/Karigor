import { apiClient } from './client';
import type { ServiceRequestDto } from './customerApi';

export interface QuotationDto {
  id: number;
  serviceRequestId: number;
  workerId: number;
  workerName: string;
  workerBio?: string;
  averageRating: number;
  proposedPrice: number;
  message?: string;
  status: string;
  parentQuotationId?: number;
  proposedBy?: 'Worker' | 'Customer' | string;
  negotiationDepth?: number;
  hasSimultaneousJobWarning?: boolean;
}

export interface WorkerQuotationSummaryDto {
  quotationId: number;
  serviceRequestId: number;
  categoryName: string;
  customerName: string;
  address: string;
  requestStatus: string;
  myInitialPrice: number;
  latestPrice: number;
  latestStatus: string; // "Pending", "Countered", "Accepted", "Rejected"
  latestProposedBy: string; // "Worker" or "Customer"
  latestMessage?: string;
  negotiationStepsCount: number;
  preferredDate: string;
}

export interface BookingDto {
  id: number;
  serviceRequestId: number;
  categoryName: string;
  workerId: number;
  workerName: string;
  customerId: number;
  customerName: string;
  agreedPrice: number;
  scheduledDate: string;
  status: string;
  address: string;
  description?: string;
  checkedInAt?: string;
  hasActiveVerificationCode?: boolean;
  verificationCodeExpiresAt?: string;
  review?: {
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
  };
}

export interface AvailableRequestDto {
  id: number;
  categoryName: string;
  description: string;
  address: string;
  preferredDate: string;
}

export const marketplaceApi = {
  getRequestDetails: async (requestId: number) => (await apiClient.get<ServiceRequestDto>(`/quotations/request/${requestId}/details`)).data,
  getQuotations: async (requestId: number) => (await apiClient.get<QuotationDto[]>(`/quotations/request/${requestId}`)).data,
  getWorkerQuotations: async () => (await apiClient.get<WorkerQuotationSummaryDto[]>('/quotations/worker')).data,
  acceptQuotation: async (id: number) => (await apiClient.post<BookingDto>(`/quotations/${id}/accept`)).data,
  counterQuotation: async (id: number, proposedPrice: number, message?: string) => (await apiClient.post<QuotationDto>(`/quotations/${id}/counter`, { proposedPrice, message })).data,
  getCustomerBookings: async () => (await apiClient.get<BookingDto[]>('/bookings/customer')).data,
  getWorkerBookings: async () => (await apiClient.get<BookingDto[]>('/bookings/worker')).data,
  getBooking: async (id: number) => (await apiClient.get<BookingDto>(`/bookings/${id}`)).data,
  updateBookingStatus: async (id: number, status: 'InProgress' | 'Completed' | 'Cancelled') => (await apiClient.put<BookingDto>(`/bookings/${id}/status`, { status })).data,
  getAvailableRequests: async () => (await apiClient.get<AvailableRequestDto[]>('/quotations/available-requests')).data,
  createQuotation: async (serviceRequestId: number, proposedPrice: number, message?: string) => (await apiClient.post<QuotationDto>('/quotations', { serviceRequestId, proposedPrice, message })).data,
  generateVerificationCode: async (id: number) => (await apiClient.post<{ verificationCode: string; expiresAt: string }>(`/bookings/${id}/verification-code`)).data,
  checkInWorker: async (id: number, verificationCode: string) => (await apiClient.post<BookingDto>(`/bookings/${id}/check-in`, { verificationCode })).data,
};
