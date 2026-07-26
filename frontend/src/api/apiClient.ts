const API_BASE_URL = `http://${window.location.hostname}:3000/api`;

export const apiClient = {
  async get<T = any>(endpoint: string): Promise<T> {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await response.json();
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
    const data = await response.json();
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
    const data = await response.json();
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
    const data = await response.json();
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
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Error en la petición POST FormData');
    }
    return data as T;
  }
};
