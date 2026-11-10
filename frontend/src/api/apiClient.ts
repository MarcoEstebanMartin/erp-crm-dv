import { API_BASE_URL } from '../utils/api';

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

  async post<T = any, B = Record<string, unknown>>(endpoint: string, body?: B): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    handleUnauthorizedIfStaffScreen(endpoint, response.status);
    const data = await parseJsonResponse(response);
    if (!response.ok) {
      throw new Error(extractApiError(data, 'Error en la petición POST'));
    }
    return data as T;
  },

  async put<T = any, B = Record<string, unknown>>(endpoint: string, body?: B): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    handleUnauthorizedIfStaffScreen(endpoint, response.status);
    const data = await parseJsonResponse(response);
    if (!response.ok) {
      throw new Error(extractApiError(data, 'Error en la petición PUT'));
    }
    return data as T;
  },

  async delete<T = any>(endpoint: string): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    handleUnauthorizedIfStaffScreen(endpoint, response.status);
    const data = await parseJsonResponse(response);
    if (!response.ok) {
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
