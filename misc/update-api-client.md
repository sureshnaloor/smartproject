# Updating API Client to Connect to Elastic Beanstalk Backend

After deploying your backend to Elastic Beanstalk and your frontend to Amplify, you need to update your frontend's API client to connect to the correct backend URL.

## 1. Create a proper API client utility

Create a new file in your client src directory:

```typescript
// client/src/lib/api-client.ts

// Get the API URL from environment variables or use a default
const API_URL = import.meta.env.VITE_API_URL || '';

/**
 * Makes an API request to the backend
 */
export const apiRequest = async (method: string, endpoint: string, data?: any) => {
  // Ensure endpoint starts with /api
  const path = endpoint.startsWith('/api') ? endpoint : `/api${endpoint}`;
  
  // Construct full URL
  const url = `${API_URL}${path}`;
  
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // Important for cookies/sessions
  };

  if (data && (method !== 'GET' && method !== 'HEAD')) {
    options.body = JSON.stringify(data);
  }

  const response = await fetch(url, options);
  
  // Handle errors
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `API request failed with status: ${response.status}`);
  }
  
  return response;
};
```

## 2. Update environment variable names in your Vite configuration

Make sure your `vite.config.ts` file defines the environment variables correctly:

```typescript
// In vite.config.ts
export default defineConfig({
  // ...other config
  define: {
    'import.meta.env.VITE_API_URL': JSON.stringify(process.env.VITE_API_URL || ''),
  },
});
```

## 3. Update existing client code to use the new API client

Find all places in your code where you make API requests and update them to use the new `apiRequest` function.

## 4. Set environment variables in AWS Amplify

In the AWS Amplify Console:

1. Go to your app
2. Navigate to "Environment variables"
3. Add a variable named `VITE_API_URL` with the value of your Elastic Beanstalk URL, for example:
   `https://your-app.elasticbeanstalk.com`
4. Save and redeploy your application

## 5. Important considerations

- Make sure CORS is properly configured on your backend to accept requests from your Amplify app domain
- For authentication, ensure your cookies are properly configured with the correct domain settings
- If you're using WebSockets, you'll need to update those URLs too 