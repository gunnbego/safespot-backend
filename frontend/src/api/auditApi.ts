import httpClient from './httpClient';

export interface AuditSubmission {
  title: string;
  category: string;
  severity: string;
  status?: string;
  notes: string;
  teamId?: string | number;
  photos?: File[];
}

export interface AuditFilter {
  userId?: string;
}

export const auditApi = {
  submitAudit: async (payload: AuditSubmission) => {
    if (payload.photos?.length) {
      const { photos, ...audit } = payload;
      const formData = new FormData();
      formData.append('audit', new Blob([JSON.stringify(audit)], { type: 'application/json' }));
      photos.forEach((photo) => formData.append('photos', photo));

      const response = await httpClient.post('/audits', formData);
      return response.data;
    }

    const response = await httpClient.post('/audits', payload);
    return response.data;
  },
  getAudits: async () => {
    const response = await httpClient.get('/audits');
    return response.data;
  },
  getAuditById: async (id: string) => {
    const response = await httpClient.get(`/audits/${id}`);
    return response.data;
  },
  getMyAudits: async () => {
    const response = await httpClient.get('/audits/mine');
    return response.data;
  },
  getTeamAudits: async () => {
    const response = await httpClient.get('/audits/team');
    return response.data;
  },
  resolveAudit: async (id: string, comment?: string, photos?: File[]) => {
    if (photos?.length) {
      const formData = new FormData();
      formData.append('resolution', new Blob([JSON.stringify({ comment })], { type: 'application/json' }));
      photos.forEach((photo) => formData.append('photos', photo));
      const response = await httpClient.patch(`/audits/${id}/resolve`, formData);
      return response.data;
    }
    const response = await httpClient.patch(`/audits/${id}/resolve`, { comment });
    return response.data;
  }
};
