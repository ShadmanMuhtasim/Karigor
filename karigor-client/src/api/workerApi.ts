import { apiClient } from './client';

export interface SkillDto {
  categoryId: number;
  categoryName: string;
  iconUrl?: string;
}

export interface WorkerProfileDto {
  id: number;
  email: string;
  bio?: string;
  hourlyRate: number;
  latitude?: number;
  longitude?: number;
  serviceRadiusKm: number;
  verificationStatus: string;
  averageRating: number;
  skills: SkillDto[];
}

export interface UpdateWorkerProfileDto {
  bio?: string;
  hourlyRate: number;
  latitude?: number;
  longitude?: number;
  serviceRadiusKm: number;
}

export interface AddSkillsDto {
  categoryIds: number[];
}

export interface AvailabilitySlotDto {
  id: number;
  dayOfWeek: number;
  startTime: string; // "HH:mm"
  endTime: string;   // "HH:mm"
}

export interface SetAvailabilitySlotDto {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface SetAvailabilityDto {
  slots: SetAvailabilitySlotDto[];
}

export interface WorkerDocumentDto {
  id: number;
  documentType: string;
  fileUrl: string;
  status: string;
}

export interface WorkerDashboardStatsDto {
  verificationStatus: string;
  totalSkills: number;
  profileCompletionPercentage: number;
  availabilityStatus: string;
  averageRating: number;
}

export const workerApi = {
  getProfile: async (): Promise<WorkerProfileDto> => {
    const response = await apiClient.get<WorkerProfileDto>('/worker/profile');
    return response.data;
  },

  updateProfile: async (data: UpdateWorkerProfileDto): Promise<void> => {
    await apiClient.put('/worker/profile', data);
  },

  getSkills: async (): Promise<SkillDto[]> => {
    const response = await apiClient.get<SkillDto[]>('/worker/skills');
    return response.data;
  },

  addSkill: async (categoryIds: number[]): Promise<void> => {
    await apiClient.post('/worker/skills', { categoryIds } as AddSkillsDto);
  },

  deleteSkill: async (categoryId: number): Promise<void> => {
    await apiClient.delete(`/worker/skills/${categoryId}`);
  },

  getAvailability: async (): Promise<AvailabilitySlotDto[]> => {
    const response = await apiClient.get<AvailabilitySlotDto[]>('/worker/availability');
    return response.data;
  },

  updateAvailability: async (slots: SetAvailabilitySlotDto[]): Promise<void> => {
    await apiClient.put('/worker/availability', { slots } as SetAvailabilityDto);
  },

  getDocuments: async (): Promise<WorkerDocumentDto[]> => {
    const response = await apiClient.get<WorkerDocumentDto[]>('/worker/documents');
    return response.data;
  },

  uploadDocument: async (documentType: string, file: File): Promise<WorkerDocumentDto> => {
    const formData = new FormData();
    formData.append('documentType', documentType);
    formData.append('file', file);
    
    const response = await apiClient.post<WorkerDocumentDto>('/worker/documents', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  getStats: async (): Promise<WorkerDashboardStatsDto> => {
    const response = await apiClient.get<WorkerDashboardStatsDto>('/worker/dashboard/stats');
    return response.data;
  }
};
