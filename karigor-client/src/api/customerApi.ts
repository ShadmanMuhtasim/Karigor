import { apiClient } from './client';
import type { SkillDto, AvailabilitySlotDto } from './workerApi';

export interface CustomerProfileDto {
  id: number;
  userId: string;
  email: string;
  fullName: string;
  address?: string;
  profileImageUrl?: string;
}

export interface UpdateCustomerProfileDto {
  fullName: string;
  address?: string;
  profileImageUrl?: string;
}

export interface CreateServiceRequestDto {
  categoryId: number;
  description: string;
  address: string;
  latitude?: number;
  longitude?: number;
  preferredDate: string; // ISO 8601 string
  photoUrls?: string;
}

export interface ServiceRequestDto {
  id: number;
  customerId: number;
  customerName: string;
  categoryId: number;
  categoryName: string;
  categoryIconUrl?: string;
  description: string;
  address: string;
  latitude?: number;
  longitude?: number;
  preferredDate: string;
  status: string;
  photoUrls?: string;
  quotationsCount: number;
}

export interface WorkerSearchParams {
  categoryId?: number;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  minRating?: number;
  searchTerm?: string;
}

export interface WorkerSearchResultDto {
  id: number;
  userId: string;
  email: string;
  bio?: string;
  hourlyRate: number;
  latitude?: number;
  longitude?: number;
  serviceRadiusKm: number;
  verificationStatus: string;
  averageRating: number;
  distanceKm?: number;
  skills: SkillDto[];
}

export interface WorkerPublicDetailDto {
  id: number;
  userId: string;
  email: string;
  bio?: string;
  hourlyRate: number;
  latitude?: number;
  longitude?: number;
  serviceRadiusKm: number;
  verificationStatus: string;
  averageRating: number;
  skills: SkillDto[];
  availability: AvailabilitySlotDto[];
}

export interface CustomerDashboardStatsDto {
  totalRequests: number;
  activeRequests: number;
  completedRequests: number;
  totalBookings: number;
}

export const customerApi = {
  getProfile: async (): Promise<CustomerProfileDto> => {
    const response = await apiClient.get<CustomerProfileDto>('/customer/profile');
    return response.data;
  },

  updateProfile: async (data: UpdateCustomerProfileDto): Promise<CustomerProfileDto> => {
    const response = await apiClient.put<CustomerProfileDto>('/customer/profile', data);
    return response.data;
  },

  createRequest: async (data: CreateServiceRequestDto): Promise<ServiceRequestDto> => {
    const response = await apiClient.post<ServiceRequestDto>('/customer/requests', data);
    return response.data;
  },

  getRequests: async (status?: string): Promise<ServiceRequestDto[]> => {
    const params = status && status !== 'All' ? { status } : {};
    const response = await apiClient.get<ServiceRequestDto[]>('/customer/requests', { params });
    return response.data;
  },

  getRequestById: async (id: number): Promise<ServiceRequestDto> => {
    const response = await apiClient.get<ServiceRequestDto>(`/customer/requests/${id}`);
    return response.data;
  },

  searchWorkers: async (params: WorkerSearchParams): Promise<WorkerSearchResultDto[]> => {
    const response = await apiClient.get<WorkerSearchResultDto[]>('/customer/workers/search', { params });
    return response.data;
  },

  getWorkerById: async (id: number): Promise<WorkerPublicDetailDto> => {
    const response = await apiClient.get<WorkerPublicDetailDto>(`/customer/workers/${id}`);
    return response.data;
  },

  getStats: async (): Promise<CustomerDashboardStatsDto> => {
    const response = await apiClient.get<CustomerDashboardStatsDto>('/customer/dashboard/stats');
    return response.data;
  },
};

