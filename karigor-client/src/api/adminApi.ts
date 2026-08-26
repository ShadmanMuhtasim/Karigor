import { apiClient } from './client';

export interface AdminStatsDto {
  totalUsers: number;
  totalCustomers: number;
  totalWorkers: number;
  verifiedWorkers: number;
  pendingVerifications: number;
  totalServiceRequests: number;
  openServiceRequests: number;
  totalBookings: number;
  completedBookings: number;
  inProgressBookings: number;
  cancelledBookings: number;
  totalPlatformVolume: number;
  averagePlatformRating: number;
  totalReviews: number;
  totalCategories: number;
}

export interface WorkerVerificationDocumentDto {
  id: number;
  documentType: string;
  fileUrl: string;
  status: string;
}

export interface PendingWorkerDto {
  workerId: number;
  userId: string;
  email: string;
  fullName?: string;
  bio?: string;
  hourlyRate: number;
  verificationStatus: string;
  averageRating: number;
  serviceRadiusKm: number;
  skills: string[];
  documents: WorkerVerificationDocumentDto[];
}

export interface VerifyWorkerPayload {
  status: 'Verified' | 'Rejected';
  note?: string;
}

export interface AdminUserDto {
  id: string;
  email: string;
  role: string;
  fullName?: string;
  isSuspended: boolean;
  lockoutEnd?: string;
  workerProfileId?: number;
  customerProfileId?: number;
}

export interface UserSuspensionPayload {
  suspend: boolean;
  reason?: string;
}

export interface AdminBookingDto {
  id: number;
  serviceRequestId: number;
  categoryName: string;
  customerId: number;
  customerName: string;
  customerEmail: string;
  workerId: number;
  workerName: string;
  workerEmail: string;
  agreedPrice: number;
  scheduledDate: string;
  status: string;
  address?: string;
  hasReview: boolean;
  reviewRating?: number;
}

export interface AdminReviewDto {
  id: number;
  bookingId: number;
  categoryName: string;
  workerId: number;
  workerName: string;
  customerId: number;
  customerName: string;
  rating: number;
  comment?: string;
  workerResponse?: string;
  bookingDate: string;
}

export interface ModerateReviewPayload {
  comment?: string;
  workerResponse?: string;
}

export interface AdminCategoryDto {
  id: number;
  name: string;
  iconUrl?: string;
  workerCount: number;
  requestCount: number;
}

export interface CreateCategoryPayload {
  name: string;
  iconUrl?: string;
}

export interface UpdateCategoryPayload {
  name: string;
  iconUrl?: string;
}

// ---------------------------------------------------------------------------
// API Client Functions
// ---------------------------------------------------------------------------

export async function getAdminStats(): Promise<AdminStatsDto> {
  const res = await apiClient.get<AdminStatsDto>('/admin/stats');
  return res.data;
}

export async function getPendingWorkers(status?: string, search?: string): Promise<PendingWorkerDto[]> {
  const params: Record<string, string> = {};
  if (status) params.status = status;
  if (search) params.search = search;
  const res = await apiClient.get<PendingWorkerDto[]>('/admin/workers/pending', { params });
  return res.data;
}

export async function verifyWorker(workerId: number, payload: VerifyWorkerPayload): Promise<PendingWorkerDto> {
  const res = await apiClient.put<PendingWorkerDto>(`/admin/workers/${workerId}/verify`, payload);
  return res.data;
}

export async function getAdminUsers(role?: string, search?: string, isSuspended?: boolean): Promise<AdminUserDto[]> {
  const params: Record<string, string | boolean> = {};
  if (role) params.role = role;
  if (search) params.search = search;
  if (typeof isSuspended === 'boolean') params.isSuspended = isSuspended;
  const res = await apiClient.get<AdminUserDto[]>('/admin/users', { params });
  return res.data;
}

export async function toggleUserSuspension(userId: string, payload: UserSuspensionPayload): Promise<AdminUserDto> {
  const res = await apiClient.put<AdminUserDto>(`/admin/users/${userId}/suspend`, payload);
  return res.data;
}

export async function getAdminBookings(status?: string, search?: string): Promise<AdminBookingDto[]> {
  const params: Record<string, string> = {};
  if (status) params.status = status;
  if (search) params.search = search;
  const res = await apiClient.get<AdminBookingDto[]>('/admin/bookings', { params });
  return res.data;
}

export async function getAdminReviews(search?: string, minRating?: number, maxRating?: number): Promise<AdminReviewDto[]> {
  const params: Record<string, string | number> = {};
  if (search) params.search = search;
  if (minRating) params.minRating = minRating;
  if (maxRating) params.maxRating = maxRating;
  const res = await apiClient.get<AdminReviewDto[]>('/admin/reviews', { params });
  return res.data;
}

export async function moderateReview(reviewId: number, payload: ModerateReviewPayload): Promise<AdminReviewDto> {
  const res = await apiClient.put<AdminReviewDto>(`/admin/reviews/${reviewId}/moderate`, payload);
  return res.data;
}

export async function deleteReview(reviewId: number): Promise<void> {
  await apiClient.delete(`/admin/reviews/${reviewId}`);
}

export async function getAdminCategories(): Promise<AdminCategoryDto[]> {
  const res = await apiClient.get<AdminCategoryDto[]>('/admin/categories');
  return res.data;
}

export async function createAdminCategory(payload: CreateCategoryPayload): Promise<AdminCategoryDto> {
  const res = await apiClient.post<AdminCategoryDto>('/admin/categories', payload);
  return res.data;
}

export async function updateAdminCategory(id: number, payload: UpdateCategoryPayload): Promise<AdminCategoryDto> {
  const res = await apiClient.put<AdminCategoryDto>(`/admin/categories/${id}`, payload);
  return res.data;
}

export async function deleteAdminCategory(id: number): Promise<void> {
  await apiClient.delete(`/admin/categories/${id}`);
}
