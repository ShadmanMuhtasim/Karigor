import { apiClient } from './client';
import type { SkillDto, WorkerProfileDto } from './workerApi';

export interface NearbyWorkerParams {
  latitude: number;
  longitude: number;
  radiusKm?: number;
  categoryId?: number;
  minRating?: number;
  searchTerm?: string;
}

export interface NearbyWorkerDto {
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
  distanceKm: number;
  skills: SkillDto[];
}

export interface UpdateWorkerLocationDto {
  latitude: number;
  longitude: number;
  serviceRadiusKm?: number;
}

export interface NearbyRequestParams {
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  categoryId?: number;
}

export interface NearbyRequestDto {
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
  distanceKm: number;
  quotationsCount: number;
}

export const locationApi = {
  getNearbyWorkers: async (params: NearbyWorkerParams): Promise<NearbyWorkerDto[]> => {
    const response = await apiClient.get<NearbyWorkerDto[]>('/workers/nearby', { params });
    return response.data;
  },

  updateWorkerLocation: async (data: UpdateWorkerLocationDto): Promise<WorkerProfileDto> => {
    const response = await apiClient.put<WorkerProfileDto>('/worker/location', data);
    return response.data;
  },

  getNearbyRequests: async (params?: NearbyRequestParams): Promise<NearbyRequestDto[]> => {
    const response = await apiClient.get<NearbyRequestDto[]>('/requests/nearby', { params });
    return response.data;
  },
};
