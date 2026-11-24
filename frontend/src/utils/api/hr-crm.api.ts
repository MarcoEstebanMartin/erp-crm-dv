import { request } from './httpClient';

export const hrCrmApi = {
  // --- RECURSOS HUMANOS Y NOMINA (RRHH) ---
  getEmployees: async (filters?: { department?: string; position?: string; active?: boolean; search?: string; month?: number; year?: number }) => {
    const params = new URLSearchParams();
    if (filters?.department) params.append('department', filters.department);
    if (filters?.position) params.append('position', filters.position);
    if (filters?.active !== undefined) params.append('active', String(filters.active));
    if (filters?.search) params.append('search', filters.search);
    if (filters?.month) params.append('month', String(filters.month));
    if (filters?.year) params.append('year', String(filters.year));
    return await request(`/hr/employees?${params.toString()}`);
  },

  getEmployeeById: async (id: number) => {
    return await request(`/hr/employees/${id}`);
  },

  createEmployee: async (data: any) => {
    return await request('/hr/employees', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  updateEmployee: async (id: number, data: any) => {
    return await request(`/hr/employees/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  deleteEmployee: async (id: number) => {
    return await request(`/hr/employees/${id}`, {
      method: 'DELETE'
    });
  },

  getAdvances: async (filters?: { employeeId?: number; status?: string }) => {
    const params = new URLSearchParams();
    if (filters?.employeeId) params.append('employeeId', String(filters.employeeId));
    if (filters?.status) params.append('status', filters.status);
    return await request(`/hr/advances?${params.toString()}`);
  },

  createAdvance: async (data: { employeeId: number; amount: number; date?: string; reason?: string; paymentMethod: string; cashDrawerId?: number; bankAccountId?: number }) => {
    return await request('/hr/advances', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  deleteAdvance: async (id: number) => {
    return await request(`/hr/advances/${id}`, {
      method: 'DELETE'
    });
  },

  calculatePayroll: async (employeeId: number, periodMonth: number, periodYear: number) => {
    return await request(`/hr/payrolls/calculate?employeeId=${employeeId}&periodMonth=${periodMonth}&periodYear=${periodYear}`);
  },

  getPayrolls: async (filters?: { periodMonth?: number; periodYear?: number; employeeId?: number }) => {
    const params = new URLSearchParams();
    if (filters?.periodMonth) params.append('periodMonth', String(filters.periodMonth));
    if (filters?.periodYear) params.append('periodYear', String(filters.periodYear));
    if (filters?.employeeId) params.append('employeeId', String(filters.employeeId));
    return await request(`/hr/payrolls?${params.toString()}`);
  },

  createPayroll: async (data: any) => {
    return await request('/hr/payrolls', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  getVacations: async (filters?: { employeeId?: number; year?: number; status?: string }) => {
    const params = new URLSearchParams();
    if (filters?.employeeId) params.append('employeeId', String(filters.employeeId));
    if (filters?.year) params.append('year', String(filters.year));
    if (filters?.status) params.append('status', filters.status);
    return await request(`/hr/vacations?${params.toString()}`);
  },

  createVacation: async (data: any) => {
    return await request('/hr/vacations', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  updateVacationStatus: async (id: number, status: string) => {
    return await request(`/hr/vacations/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
  },

  deleteVacation: async (id: number) => {
    return await request(`/hr/vacations/${id}`, {
      method: 'DELETE'
    });
  },

  getDocuments: async (filters?: { employeeId?: number }) => {
    const params = new URLSearchParams();
    if (filters?.employeeId) params.append('employeeId', String(filters.employeeId));
    return await request(`/hr/documents?${params.toString()}`);
  },

  createDocument: async (data: any) => {
    return await request('/hr/documents', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  // --- WHATSAPP CRM ---
  getCrmConversations: async () => {
    return await request('/crm/whatsapp/conversations');
  },

  deleteCrmConversation: async (conversationId: number) => {
    return await request(`/crm/whatsapp/conversations/${conversationId}`, {
      method: 'DELETE'
    });
  },

  getCrmMessages: async (conversationId: number) => {
    return await request(`/crm/whatsapp/conversations/${conversationId}/messages`);
  },

  sendCrmMessage: async (data: { to: string; text: string; mediaUrl?: string; mediaType?: string }) => {
    return await request('/crm/whatsapp/send-message', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  parseCrmOrderDraft: async (conversationId: number, rawText: string) => {
    return await request(`/crm/whatsapp/conversations/${conversationId}/parse-order`, {
      method: 'POST',
      body: JSON.stringify({ rawText })
    });
  },

  approveCrmOrderDraft: async (draftId: number, items?: any[]) => {
    return await request(`/crm/whatsapp/drafts/${draftId}/approve`, {
      method: 'POST',
      body: items ? JSON.stringify({ items }) : undefined
    });
  },

  toggleCrmAutoReply: async (conversationId: number, enabled: boolean) => {
    return await request(`/crm/whatsapp/conversations/${conversationId}/auto-reply`, {
      method: 'PUT',
      body: JSON.stringify({ enabled })
    });
  },

  updateCrmStage: async (conversationId: number, stage: string) => {
    return await request(`/crm/whatsapp/conversations/${conversationId}/stage`, {
      method: 'PUT',
      body: JSON.stringify({ stage })
    });
  },

  linkCrmPersona: async (conversationId: number, personaId: number) => {
    return await request(`/crm/whatsapp/conversations/${conversationId}/link-persona`, {
      method: 'PUT',
      body: JSON.stringify({ personaId })
    });
  },

  assignCrmConversation: async (conversationId: number, assignedUserId: number | null) => {
    return await request(`/crm/whatsapp/conversations/${conversationId}/assign`, {
      method: 'PUT',
      body: JSON.stringify({ assignedUserId })
    });
  },

  sendCrmDeliveryNotification: async (orderId: number) => {
    return await request(`/crm/whatsapp/orders/${orderId}/notify-delivery`, {
      method: 'POST'
    });
  },

  simulateCrmIncomingMessage: async (data: { fromPhone: string; profileName?: string; text: string }) => {
    return await request('/crm/whatsapp/simulate-incoming', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  broadcastCrmCampaign: async (data: { campaignId: number; targetSegment: string; routeName?: string }) => {
    return await request('/crm/whatsapp/campaigns/broadcast', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  getPersonaFromAFIP: async (cuit: string) => {
    return await request(`/personas/afip/${cuit}`);
  }
};
