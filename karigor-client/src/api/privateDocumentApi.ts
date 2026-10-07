import { apiClient } from './client';

export const MAX_PRIVATE_DOCUMENT_BYTES = 5 * 1024 * 1024;

export async function fetchPrivateDocument(fileUrl: string, signal: AbortSignal): Promise<Blob> {
  // A server-provided path still must not redirect our Bearer header to an arbitrary origin.
  if (!/^\/uploads\/worker-documents\/[1-9]\d*\/[a-f0-9]{32}\.(pdf|png|jpe?g)$/i.test(fileUrl)) {
    throw new Error('Invalid private document path.');
  }
  const response = await apiClient.get<Blob>(fileUrl, { baseURL: '/', responseType: 'blob', signal });
  const expectedType = fileUrl.toLowerCase().endsWith('.pdf') ? 'application/pdf'
    : fileUrl.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
  if (!(response.data instanceof Blob) || response.data.type !== expectedType ||
    response.data.size === 0 || response.data.size > MAX_PRIVATE_DOCUMENT_BYTES) {
    throw new Error('Invalid private document response.');
  }
  return response.data;
}
