import { apiClient } from './client';

export interface CategoryDto {
  id: number;
  name: string;
  iconUrl?: string;
}

export interface PaginatedCategoriesDto {
  value: CategoryDto[];
  count: number;
}

export const categoryApi = {
  getCategories: async (): Promise<CategoryDto[]> => {
    const response = await apiClient.get<CategoryDto[]>('/categories');
    return response.data;
  }
};
