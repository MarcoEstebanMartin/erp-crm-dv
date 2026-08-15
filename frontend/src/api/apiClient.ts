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

export const apiClient = {
  async get<T = any>(endpoint: string): Promise<T> {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await parseJsonResponse(response);
    if (!response.ok) {
      throw new Error(data.message || 'Error en la petición GET');
    }
    return data as T;
  },

  async post<T = any, B = Record<string, unknown>>(endpoint: string, body?: B): Promise<T> {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await parseJsonResponse(response);
    if (!response.ok) {
      throw new Error(data.message || 'Error en la petición POST');
    }
    return data as T;
  },

  async put<T = any, B = Record<string, unknown>>(endpoint: string, body?: B): Promise<T> {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await parseJsonResponse(response);
    if (!response.ok) {
      throw new Error(data.message || 'Error en la petición PUT');
    }
    return data as T;
  },

  async delete<T = any>(endpoint: string): Promise<T> {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await parseJsonResponse(response);
    if (!response.ok) {
      throw new Error(data.message || 'Error en la petición DELETE');
    }
    return data as T;
  },

  async postFormData<T = any>(endpoint: string, formData: FormData): Promise<T> {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });
    const data = await parseJsonResponse(response);
    if (!response.ok) {
      throw new Error(data.message || 'Error en la petición POST FormData');
    }
    return data as T;
  }
};
