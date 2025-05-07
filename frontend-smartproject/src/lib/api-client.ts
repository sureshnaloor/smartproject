/**
 * API client for connecting to the backend
 * This file handles all communication with the backend server
 */

// With Vite proxy, we don't need an API URL as requests will be proxied automatically
const API_URL = '';

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
  
  // Debug log
  console.log(`Making ${method} request to: ${path}`);
  
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    }
  };

  // Add body data for non-GET requests
  if (data && !['GET', 'HEAD'].includes(method)) {
    options.body = JSON.stringify(data);
  }

  try {
    console.log('Request options:', options);
    const response = await fetch(path, options);
    console.log(`Response status: ${response.status}`);
    
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
      (error as any).request = { method, path, data };
      console.error('API request failed:', error);
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