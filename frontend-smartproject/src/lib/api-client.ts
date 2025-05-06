/**
 * API client for connecting to the backend
 * This file handles all communication with the backend server
 */

// Get the API URL from environment variables with a fallback for local development
const API_URL = import.meta.env.VITE_API_URL || '';

// Log the API URL in development to help with debugging
if (process.env.NODE_ENV !== 'production') {
  console.log(`API requests will be sent to: ${API_URL || 'this server (no API_URL specified)'}`);
}

/**
 * Makes an API request to the backend
 * @param method - HTTP method
 * @param endpoint - API endpoint (with or without /api prefix)
 * @param data - Optional data to send with the request
 * @returns The fetch response object
 */
export const apiRequest = async (method: string, endpoint: string, data?: any) => {
  // Ensure endpoint starts with /api
  const path = endpoint.startsWith('/api') ? endpoint : `/api${endpoint}`;
  
  // Construct full URL (if API_URL is empty, the request will be relative to the current origin)
  const url = `${API_URL}${path}`;
  
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    credentials: 'include', // Important for sessions/cookies
  };

  // Add body data for non-GET requests
  if (data && !['GET', 'HEAD'].includes(method)) {
    options.body = JSON.stringify(data);
  }

  try {
    const response = await fetch(url, options);
    
    // Handle HTTP errors
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const error = new Error(errorData.message || `API request failed with status: ${response.status}`);
      (error as any).status = response.status;
      (error as any).data = errorData;
      throw error;
    }
    
    return response;
  } catch (error) {
    // Add request details to error for better debugging
    if (error instanceof Error) {
      (error as any).request = { method, url, data };
    }
    throw error;
  }
};

/**
 * Shorthand for making a GET request
 * @param endpoint - API endpoint
 * @returns The JSON response data
 */
export const get = async (endpoint: string) => {
  const response = await apiRequest('GET', endpoint);
  return response.json();
};

/**
 * Shorthand for making a POST request
 * @param endpoint - API endpoint
 * @param data - Data to send in the request body
 * @returns The JSON response data
 */
export const post = async (endpoint: string, data?: any) => {
  const response = await apiRequest('POST', endpoint, data);
  return response.json();
};

/**
 * Shorthand for making a PUT request
 * @param endpoint - API endpoint
 * @param data - Data to send in the request body
 * @returns The JSON response data
 */
export const put = async (endpoint: string, data?: any) => {
  const response = await apiRequest('PUT', endpoint, data);
  return response.json();
};

/**
 * Shorthand for making a PATCH request
 * @param endpoint - API endpoint
 * @param data - Data to send in the request body
 * @returns The JSON response data
 */
export const patch = async (endpoint: string, data?: any) => {
  const response = await apiRequest('PATCH', endpoint, data);
  return response.json();
};

/**
 * Shorthand for making a DELETE request
 * @param endpoint - API endpoint
 * @returns The JSON response data
 */
export const del = async (endpoint: string) => {
  const response = await apiRequest('DELETE', endpoint);
  return response.json();
};

export default {
  request: apiRequest,
  get,
  post,
  put,
  patch,
  delete: del
}; 