import { request } from './httpClient';
import { PaymentMethod } from '../types';

export const personasApi = {
  // --- PERSONAS ---
  getPersonas: async (role?: string, search?: string) => {    
    let path = '/personas';
    const params = [];
    if (role) params.push(`role=${role}`);
    if (search) params.push(`search=${search}`);
    if (params.length > 0) path += `?${params.join('&')}`;

    const res = await request(path);
    return res.personas;
  },

  getDebtorsReport: async (asOfDate?: string) => {
    const query = asOfDate ? `?asOfDate=${encodeURIComponent(asOfDate)}` : '';
    const res = await request(`/personas/debtors-report${query}`);
    return res;
  },

  getClients: async (search?: string) => {
    return personasApi.getPersonas('client', search);
  },

  getSellersList: async () => {
    const res = await request('/personas/sellers');
    return res.sellers;
  },

  getSellerProfileStats: async (id: number) => {
    const res = await request(`/personas/sellers/${id}/profile`);
    return res;
  },

  recordClientVisit: async (id: number, reason: string, notes?: string | null) => {
    const res = await request(`/personas/${id}/visit`, {
      method: 'POST',
      body: JSON.stringify({ reason, notes })
    });
    return res;
  },

  getAfipData: async (cuit: string) => {
    
    const res = await request(`/personas/afip/${cuit}`);
    return res;
  },


  createPersona: async (personaData: any) => {    
    const res = await request('/personas', {
      method: 'POST',
      body: JSON.stringify(personaData)
    });
    return res.persona;
  },

  createClient: async (clientData: any) => {
    return personasApi.createPersona({ ...clientData, isClient: true });
  },

  updatePersona: async (id: number, personaData: any) => {    
    const res = await request(`/personas/${id}`, {
      method: 'PUT',
      body: JSON.stringify(personaData)
    });
    return res.persona;
  },

  updateClient: async (id: number, clientData: any) => {
    return personasApi.updatePersona(id, clientData);
  },

  updateClientTrustTags: async (personaId: number, trustTags: string[]) => {
    const res = await request(`/personas/${personaId}/trust-tags`, {
      method: 'PATCH',
      body: JSON.stringify({ trustTags }),
    });
    return res.data;
  },

  getClientNotes: async (personaId: number) => {
    const res = await request(`/personas/${personaId}/notes`);
    return res.data.notes || [];
  },

  createClientNote: async (
    personaId: number,
    payload: { content: string; category: string; isPinned?: boolean },
  ) => {
    const res = await request(`/personas/${personaId}/notes`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.data.note;
  },

  togglePinClientNote: async (personaId: number, noteId: number) => {
    const res = await request(`/personas/${personaId}/notes/${noteId}/pin`, {
      method: 'PATCH',
    });
    return res.data.note;
  },

  deleteClientNote: async (personaId: number, noteId: number) => {
    const res = await request(`/personas/${personaId}/notes/${noteId}`, {
      method: 'DELETE',
    });
    return res.data;
  },

  deletePersona: async (id: number) => {
    return await request(`/personas/${id}`, {
      method: 'DELETE'
    });
  },

  registerPayment: async (personaId: number, paymentData: { amount?: number, paymentMethod?: string, payments?: { amount: number, paymentMethod: string, bankAccountId?: number | null, description?: string, checkNumber?: string, checkBank?: string, checkDueDate?: string, isEcheq?: boolean }[], description?: string, branch?: string, type?: string, supplierInvoiceId?: number, orderId?: number, orderIds?: number[], applyToUnbilledBalance?: boolean, bankAccountId?: number | null, checkNumber?: string, checkBank?: string, checkDueDate?: string, isEcheq?: boolean, allowCreditOnAccount?: boolean, retenciones?: { taxType: 'GANANCIAS' | 'IIBB', number: string, amount: number }[] }) => {    
    const res = await request(`/personas/${personaId}/payments`, {
      method: 'POST',
      body: JSON.stringify(paymentData)
    });
    return res;
  },

  getPersonaPendingInvoices: async (personaId: number) => {
    const res = await request(`/personas/${personaId}/pending-invoices`);
    return res;
  },

  getPersonaLedger: async (personaId: number) => {
    
    const res = await request(`/personas/${personaId}/ledger`);
    return res;
  },

  getClientLedger: async (clientId: number) => {
    const res = await personasApi.getPersonaLedger(clientId);
    return { client: res.persona, ledger: res.ledger };
  }
};
