import { apiClient } from './client';

export interface QuotationDto { id: number; serviceRequestId: number; workerId: number; workerName: string; workerBio?: string; averageRating: number; proposedPrice: number; message?: string; status: string; parentQuotationId?: number; }
export interface BookingDto { id: number; serviceRequestId: number; categoryName: string; workerId: number; workerName: string; customerId: number; customerName: string; agreedPrice: number; scheduledDate: string; status: string; address: string; description?: string; }
export interface AvailableRequestDto { id: number; categoryName: string; description: string; address: string; preferredDate: string; }

export const marketplaceApi = {
  getQuotations: async (requestId: number) => (await apiClient.get<QuotationDto[]>(`/quotations/request/${requestId}`)).data,
  acceptQuotation: async (id: number) => (await apiClient.post<BookingDto>(`/quotations/${id}/accept`)).data,
  counterQuotation: async (id: number, proposedPrice: number, message?: string) => (await apiClient.post<QuotationDto>(`/quotations/${id}/counter`, { proposedPrice, message })).data,
  getCustomerBookings: async () => (await apiClient.get<BookingDto[]>('/bookings/customer')).data,
  getWorkerBookings: async () => (await apiClient.get<BookingDto[]>('/bookings/worker')).data,
  getBooking: async (id: number) => (await apiClient.get<BookingDto>(`/bookings/${id}`)).data,
  updateBookingStatus: async (id: number, status: 'InProgress' | 'Completed' | 'Cancelled') => (await apiClient.put<BookingDto>(`/bookings/${id}/status`, { status })).data,
  getAvailableRequests: async () => (await apiClient.get<AvailableRequestDto[]>('/quotations/available-requests')).data,
  createQuotation: async (serviceRequestId: number, proposedPrice: number, message?: string) => (await apiClient.post<QuotationDto>('/quotations', { serviceRequestId, proposedPrice, message })).data,
};
