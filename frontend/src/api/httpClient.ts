import axios, { AxiosError, AxiosHeaders } from 'axios';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api';

const httpClient = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    'Content-Type': 'application/json'
  }
});

/**
 * Request Interceptor: Add JWT token to Authorization header
 * - Safely retrieves token from localStorage with error handling
 * - Initializes headers if undefined
 * - Adds Bearer prefix if not already present
 */
httpClient.interceptors.request.use(
  (config) => {
    try {
      config.headers = AxiosHeaders.from(config.headers);
      if (config.data instanceof FormData) {
        config.headers.delete('Content-Type');
      }

      // Safely retrieve token from localStorage
      let token: string | null = null;
      try {
        token = window.localStorage.getItem('safespot_token');
      } catch (storageError) {
        console.warn('Unable to access localStorage:', storageError);
      }

      // Add Authorization header if token exists
      const isPublicAuthEndpoint = config.url?.startsWith('/auth/')
        && config.url !== '/auth/validate';
      if (token && token.trim() && !isPublicAuthEndpoint) {
        const bearerToken = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
        config.headers.set('Authorization', bearerToken);
      }

      return config;
    } catch (error) {
      console.error('Request interceptor error:', error);
      return config;
    }
  },
  (error) => {
    console.error('Request interceptor setup error:', error);
    return Promise.reject(error);
  }
);

/**
 * Response Interceptor: Handle authentication errors
 * - Catches 401 Unauthorized responses
 * - Clears invalid token from localStorage
 * - Redirects to login page
 * - Logs error for debugging
 */
httpClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Log the 401 error
      console.warn('Unauthorized (401): Token may be invalid or expired');

      // Clear invalid token from localStorage
      try {
        window.localStorage.removeItem('safespot_token');
        window.localStorage.removeItem('safespot_org_slug');
      } catch (storageError) {
        console.warn('Unable to clear token from localStorage:', storageError);
      }

      // Redirect to login page
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    } else if (error.response) {
      // Log other HTTP errors
      console.error(
        `HTTP Error ${error.response.status}:`,
        error.response.data || error.message
      );
    } else if (error.request) {
      // Log network errors
      console.error('Network error - no response received:', error.request);
    } else {
      // Log other errors
      console.error('Error:', error.message);
    }

    // Always reject the error so callers know the request failed
    return Promise.reject(error);
  }
);

export default httpClient;
