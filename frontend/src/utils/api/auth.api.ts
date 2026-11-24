import { API_BASE_URL, request, syncServerConfig } from './httpClient';
import { type CompanyProfile, purgeLegacyCompanyLocalStorage } from '../companyProfile';
import { setRuntimeGoogleMapsApiKey } from '../googleMapsLoader';

export const authApi = {
  // --- AUTENTICACIÓN ---
  login: async (username: string, password: string) => {
    const res = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    if (!res) {
      throw new Error('Respuesta inválida del servidor');
    }
    // Purgar cualquier token legado en localStorage; la sesión reside en Cookie HttpOnly
    localStorage.removeItem('auth_token');
    if (res.user) {
      localStorage.setItem('auth_user', JSON.stringify(res.user));
    }
    if (res.config) {
      syncServerConfig(res.config);
    } else {
      purgeLegacyCompanyLocalStorage();
    }
    return res;
  },

  logout: () => {
    fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    }).catch(() => {});
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth_config');
    setRuntimeGoogleMapsApiKey(null);
  },

  changeOwnPassword: async (currentPassword: string, newPassword: string) => {
    return await request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },

  getCurrentUser: () => {
    const userStr = localStorage.getItem('auth_user');
    return userStr ? JSON.parse(userStr) : null;
  },

  getMe: async () => {
    try {
      const res = await request('/auth/me');
      const resolvedUser = res?.user || res?.data?.user || null;
      const resolvedConfig = res?.config || res?.data?.config || null;
      if (resolvedUser) {
        localStorage.setItem('auth_user', JSON.stringify(resolvedUser));
      }
      if (resolvedConfig) {
        syncServerConfig(resolvedConfig);
      }
      return resolvedUser;
    } catch (e) {
      return null;
    }
  },

  getServerConfig: () => {
    const configStr = localStorage.getItem('auth_config');
    return configStr ? JSON.parse(configStr) : null;
  },

  fetchServerConfig: async () => {
    const cfg = await request('/admin/config');
    if (cfg) {
      syncServerConfig(cfg);
    }
    return cfg;
  },

  updateServerConfig: async (config: { ignoreStockCheck?: boolean; afipMockMode?: boolean; company?: Partial<CompanyProfile> }) => {
    try {
      const cfg = await request('/admin/config', {
        method: 'POST',
        body: JSON.stringify(config),
      });
      if (cfg) {
        syncServerConfig(cfg);
      }
      return cfg;
    } catch (error) {
      console.error('Error updating config', error);
      throw error;
    }
  }
};
