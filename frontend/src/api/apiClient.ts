import { API_BASE_URL } from '../utils/api';
import {
  evictRequestIdempotencyKey,
  resolveRequestIdempotencyKey,
} from '../utils/idempotencyClient';

async function parseJsonResponse(response: Response) {
  const text = await response.text();
  if (!text || !text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch (e) {
    console.error('Error al parsear respuesta JSON:', e);
    return {};
  }
}

function handleUnauthorizedIfStaffScreen(endpoint: string, status: number): void {
  if (status !== 401) return;
  if (endpoint.startsWith('/collections/receipt/') || endpoint.startsWith('/store/')) return;
  localStorage.removeItem('auth_token');
  localStorage.removeItem('auth_user');
  if (
    typeof window !== 'undefined' &&
    !window.location.pathname.startsWith('/login') &&
    !window.location.pathname.startsWith('/tienda') &&
    !window.location.pathname.startsWith('/recibo/')
  ) {
    window.location.href = '/login';
  }
}

function extractApiError(data: any, fallback: string): string {
  return data?.message || data?.error || fallback;
}

export const apiClient = {
  async get<T = any>(endpoint: string): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      credentials: 'include',
    });
    handleUnauthorizedIfStaffScreen(endpoint, response.status);
    const data = await parseJsonResponse(response);
    if (!response.ok) {
      throw new Error(extractApiError(data, 'Error en la petición GET'));
    }
    return data as T;
  },

  async post<T = any, B = Record<string, unknown>>(
    endpoint: string,
    body?: B,
    options?: { idempotencyKey?: string },
  ): Promise<T> {
    const serialized = body ? JSON.stringify(body) : undefined;
    const idempotencyKey = resolveRequestIdempotencyKey(
      'POST',
      endpoint,
      serialized,
      options?.idempotencyKey,
    );
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: serialized,
    });
    handleUnauthorizedIfStaffScreen(endpoint, response.status);
    const data = await parseJsonResponse(response);
    if (!response.ok) {
      if (response.status >= 400 && response.status !== 409) {
        evictRequestIdempotencyKey('POST', endpoint, serialized);
      }
      throw new Error(extractApiError(data, 'Error en la petición POST'));
    }
    return data as T;
  },

  async put<T = any, B = Record<string, unknown>>(
    endpoint: string,
    body?: B,
    options?: { idempotencyKey?: string },
  ): Promise<T> {
    const serialized = body ? JSON.stringify(body) : undefined;
    const idempotencyKey = resolveRequestIdempotencyKey(
      'PUT',
      endpoint,
      serialized,
      options?.idempotencyKey,
    );
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: serialized,
    });
    handleUnauthorizedIfStaffScreen(endpoint, response.status);
    const data = await parseJsonResponse(response);
    if (!response.ok) {
      if (response.status >= 400 && response.status !== 409) {
        evictRequestIdempotencyKey('PUT', endpoint, serialized);
      }
      throw new Error(extractApiError(data, 'Error en la petición PUT'));
    }
    return data as T;
  },

  async patch<T = any, B = Record<string, unknown>>(
    endpoint: string,
    body?: B,
    options?: { idempotencyKey?: string },
  ): Promise<T> {
    const serialized = body ? JSON.stringify(body) : undefined;
    const idempotencyKey = resolveRequestIdempotencyKey(
      'PATCH',
      endpoint,
      serialized,
      options?.idempotencyKey,
    );
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: serialized,
    });
    handleUnauthorizedIfStaffScreen(endpoint, response.status);
    const data = await parseJsonResponse(response);
    if (!response.ok) {
      if (response.status >= 400 && response.status !== 409) {
        evictRequestIdempotencyKey('PATCH', endpoint, serialized);
      }
      throw new Error(extractApiError(data, 'Error en la petición PATCH'));
    }
    return data as T;
  },

  async delete<T = any>(
    endpoint: string,
    options?: { idempotencyKey?: string },
  ): Promise<T> {
    const idempotencyKey = resolveRequestIdempotencyKey(
      'DELETE',
      endpoint,
      undefined,
      options?.idempotencyKey,
    );
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: {
        'Idempotency-Key': idempotencyKey,
      },
    });
    handleUnauthorizedIfStaffScreen(endpoint, response.status);
    const data = await parseJsonResponse(response);
    if (!response.ok) {
      if (response.status >= 400 && response.status !== 409) {
        evictRequestIdempotencyKey('DELETE', endpoint);
      }
      throw new Error(extractApiError(data, 'Error en la petición DELETE'));
    }
    return data as T;
  },

  async postFormData<T = any>(endpoint: string, formData: FormData): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
    handleUnauthorizedIfStaffScreen(endpoint, response.status);
    const data = await parseJsonResponse(response);
    if (!response.ok) {
      throw new Error(extractApiError(data, 'Error en la petición POST FormData'));
    }
    return data as T;
  },
};
