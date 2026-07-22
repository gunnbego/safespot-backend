import httpClient from './httpClient';

export interface LoginPayload {
  username: string;
  password: string;
  organizationSlug: string;
}

export interface RegisterPayload {
  username: string;
  password: string;
  organizationSlug: string;
}

export interface AccountUpdatePayload {
  name: string;
  email: string;
}

export interface LoginResponse {
  token: string;
  expiresIn: number;
  user: {
    id: string;
    username: string;
    email: string;
    role: 'MEMBER' | 'MANAGER';
    organizationId: string;
    teamId?: string | number | null;
    teamName?: string | null;
  } | null;
  organizationContext?: {
    organizationId: string;
    organizationSlug: string;
  };
}

export interface TokenValidationResponse {
  valid: boolean;
}

export const authApi = {
  login: async (payload: LoginPayload): Promise<LoginResponse> => {
    const response = await httpClient.post('/auth/login', {
      username: payload.username,
      password: payload.password,
      organizationSlug: payload.organizationSlug
    });
    return response.data;
  },
  register: async (payload: RegisterPayload) => {
    const response = await httpClient.post('/auth/register', {
      username: payload.username,
      password: payload.password,
      organizationSlug: payload.organizationSlug
    });
    return response.data;
  },
  validateToken: async (): Promise<TokenValidationResponse> => {
    const response = await httpClient.post('/auth/validate');
    return response.data;
  },
  getProfile: async () => {
    const response = await httpClient.get('/users/me');
    return response.data;
  },
  updateAccount: async (payload: AccountUpdatePayload) => {
    const response = await httpClient.put('/auth/profile', payload);
    return response.data;
  }
};
