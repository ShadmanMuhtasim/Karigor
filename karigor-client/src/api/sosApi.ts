import { apiClient } from './client';

export interface SosAlertDto {
  id: number;
  bookingId: number;
  customerId: number;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  workerId: number;
  workerName: string;
  workerPhone?: string;
  workerEmail?: string;
  serviceCategoryName: string;
  serviceAddress: string;
  agreedPrice: number;
  scheduledDate: string;
  bookingStatus: string;
  triggeredAt: string;
  status: 'Open' | 'Contacted' | 'Resolved' | 'Escalated';
  adminNotes?: string;
  resolvedAt?: string;
  resolvedByAdminId?: string;
  resolvedByAdminEmail?: string;
}

export interface UpdateSosStatusDto {
  status: 'Open' | 'Contacted' | 'Resolved' | 'Escalated';
  adminNotes?: string;
}

export interface TerminateSosJobDto {
  adminNotes?: string;
}

/** Trigger SOS emergency alert for a booking (Customer only) */
export async function triggerSos(bookingId: number): Promise<SosAlertDto> {
  const res = await apiClient.post<SosAlertDto>(`/bookings/${bookingId}/sos`);
  return res.data;
}

/** Get SOS alerts (Admin only) */
export async function getSosAlerts(status?: string): Promise<SosAlertDto[]> {
  const params: Record<string, string> = {};
  if (status) params.status = status;
  const res = await apiClient.get<SosAlertDto[]>('/admin/sos', { params });
  return res.data;
}

/** Update SOS alert status / admin notes (Admin only) */
export async function updateSosStatus(alertId: number, dto: UpdateSosStatusDto): Promise<SosAlertDto> {
  const res = await apiClient.put<SosAlertDto>(`/admin/sos/${alertId}/status`, dto);
  return res.data;
}

/** Terminate booking due to SOS emergency (Admin only) */
export async function terminateSosJob(alertId: number, dto?: TerminateSosJobDto): Promise<SosAlertDto> {
  const res = await apiClient.put<SosAlertDto>(`/admin/sos/${alertId}/terminate`, dto || {});
  return res.data;
}
