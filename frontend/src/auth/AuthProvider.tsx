import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { authApi } from '../api/authApi';

export type UserRole = 'member' | 'manager';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  teamId?: string;
  teamName?: string;
}

const mapUserProfile = (profile: any): UserProfile => ({
  id: String(profile.id),
  name: profile.name ?? profile.username,
  email: profile.email ?? profile.username,
  role: profile.role === 'MANAGER' ? 'manager' : 'member',
  teamId: profile.teamId == null ? undefined : String(profile.teamId),
  teamName: profile.teamName ?? undefined
});

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  organizationSlug?: string;
  login: (username: string, password: string, organizationSlug: string) => Promise<void>;
  logout: () => void;
  updateAccount: (name: string, email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [organizationSlug, setOrganizationSlug] = useState<string | undefined>();

  useEffect(() => {
    const token = window.localStorage.getItem('safespot_token');
    const storedOrgSlug = window.localStorage.getItem('safespot_org_slug') ?? undefined;
    setOrganizationSlug(storedOrgSlug);

    if (!token) {
      setLoading(false);
      return;
    }

    // Validate token before attempting to fetch profile
    authApi
      .validateToken()
      .then((validationResult) => {
        if (!validationResult.valid) {
          console.warn('[Auth] Token validation failed - clearing localStorage');
          window.localStorage.removeItem('safespot_token');
          window.localStorage.removeItem('safespot_org_slug');
          setUser(null);
          setOrganizationSlug(undefined);
          return;
        }

        // Token is valid, fetch profile
        console.debug('[Auth] Token is valid, fetching user profile');
        return authApi.getProfile();
      })
      .then((profile) => {
        if (profile) {
          console.debug('[Auth] Profile loaded successfully');
          setUser(mapUserProfile(profile));
        }
      })
      .catch((error) => {
        console.error('[Auth] Error during initialization:', error);
        window.localStorage.removeItem('safespot_token');
        window.localStorage.removeItem('safespot_org_slug');
        setUser(null);
        setOrganizationSlug(undefined);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const login = async (username: string, password: string, orgSlug: string) => {
    try {
      console.debug('[Auth] Logging in user:', username);

      // Call login endpoint
      const loginResponse = await authApi.login({ username, password, organizationSlug: orgSlug });

      // Store token and organization slug in localStorage
      window.localStorage.setItem('safespot_token', loginResponse.token);
      const canonicalOrgSlug = loginResponse.organizationContext?.organizationSlug ?? orgSlug;
      window.localStorage.setItem('safespot_org_slug', canonicalOrgSlug);
      console.debug('[Auth] Token stored, expires in:', loginResponse.expiresIn);

      // Use user info directly from login response to avoid race condition
      if (loginResponse.user) {
        const userProfile = mapUserProfile(loginResponse.user);
        console.debug('[Auth] User profile from login response:', userProfile.email);
        setUser(userProfile);
        setOrganizationSlug(canonicalOrgSlug);
        return;
      }

      // Fallback: if login response doesn't include user, fetch profile
      console.debug('[Auth] No user in login response, fetching profile');
      try {
        const profile = await authApi.getProfile();
        setUser(mapUserProfile(profile));
        setOrganizationSlug(canonicalOrgSlug);
      } catch (profileError) {
        console.error(
          '[Auth] Profile fetch failed after successful login, continuing with login response user:',
          profileError
        );
        // Even if profile fetch fails, we already have the token and user from login response
        // Don't fail the entire login operation
        if (loginResponse.user) {
          setUser(mapUserProfile(loginResponse.user));
          setOrganizationSlug(canonicalOrgSlug);
        }
      }
    } catch (error) {
      console.error('[Auth] Login failed:', error);
      window.localStorage.removeItem('safespot_token');
      window.localStorage.removeItem('safespot_org_slug');
      setUser(null);
      setOrganizationSlug(undefined);
      throw error;
    }
  };

  const logout = () => {
    console.debug('[Auth] Logging out user');
    window.localStorage.removeItem('safespot_token');
    window.localStorage.removeItem('safespot_org_slug');
    setUser(null);
    setOrganizationSlug(undefined);
  };

  const updateAccount = async (name: string, email: string) => {
    try {
      console.debug('[Auth] Updating account:', email);
      const profile = await authApi.updateAccount({ name, email });
      setUser(mapUserProfile(profile));
    } catch (error) {
      console.error('[Auth] Account update failed:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateAccount, organizationSlug }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
