import httpClient from './httpClient';

export interface Team {
  id: number;
  name: string;
  memberCount: number;
  members: string[];
}

export interface OrganizationMember {
  id: number;
  username: string;
  email?: string | null;
  phone?: string | null;
  role: 'MEMBER' | 'MANAGER';
  teamId?: number | null;
  teamName?: string | null;
  organizationId: number;
  organizationName?: string | null;
}

export interface MemberPayload {
  username: string;
  email?: string;
  phone?: string;
  role: 'MEMBER' | 'MANAGER';
  teamId?: number | null;
}

export interface InvitePayload extends MemberPayload {
  password: string;
}

export const teamApi = {
  getTeamMembers: async () => {
    const response = await httpClient.get('/tenant/members');
    return response.data;
  },
  getOrganizationMembers: async (): Promise<OrganizationMember[]> => {
    const response = await httpClient.get('/tenant/members');
    return response.data;
  },
  inviteMember: async (payload: InvitePayload): Promise<OrganizationMember> => {
    const response = await httpClient.post('/tenant/invite', payload);
    return response.data;
  },
  updateMember: async (id: number, payload: MemberPayload): Promise<OrganizationMember> => {
    const response = await httpClient.put(`/tenant/members/${id}`, payload);
    return response.data;
  },
  resetMemberPassword: async (id: number, password: string): Promise<OrganizationMember> => {
    const response = await httpClient.patch(`/tenant/members/${id}/password`, { password });
    return response.data;
  },
  deleteMember: async (id: number): Promise<void> => {
    await httpClient.delete(`/tenant/members/${id}`);
  },
  getTeams: async (): Promise<Team[]> => {
    const response = await httpClient.get('/teams');
    return response.data;
  },
  createTeam: async (name: string): Promise<Team> => {
    const response = await httpClient.post('/teams', { name });
    return response.data;
  },
  updateTeam: async (id: number, name: string): Promise<Team> => {
    const response = await httpClient.put(`/teams/${id}`, { name });
    return response.data;
  },
  deleteTeam: async (id: number): Promise<void> => {
    await httpClient.delete(`/teams/${id}`);
  }
};
