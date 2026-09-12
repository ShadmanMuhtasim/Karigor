import { apiClient } from './client';

export interface InitiatePaymentResponseDto {
  gatewayUrl: string;
  transactionId: string;
  totalAmount: number;
  platformFee: number;
  serviceCharge: number;
  totalFee: number;
  workerAmount: number;
}

export interface PaymentDetailsDto {
  id: number;
  bookingId: number;
  transactionId: string;
  valId?: string;
  bankTranId?: string;
  cardType?: string;
  currency: string;
  totalAmount: number;
  platformFee: number;
  serviceCharge: number;
  totalFee: number;
  workerAmount: number;
  status: string;
  createdAt: string;
  paidAt?: string;
}

export const paymentApi = {
  initiatePayment: async (bookingId: number): Promise<InitiatePaymentResponseDto> => {
    const res = await apiClient.post<InitiatePaymentResponseDto>('/payments/initiate', { bookingId });
    return res.data;
  },

  getBookingPayment: async (bookingId: number): Promise<PaymentDetailsDto> => {
    const res = await apiClient.get<PaymentDetailsDto>(`/payments/booking/${bookingId}`);
    return res.data;
  },
};
