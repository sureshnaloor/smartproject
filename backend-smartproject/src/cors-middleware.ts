import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to handle CORS for the Express backend
 * Allows connections from AWS Amplify frontend
 */
export const corsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Get CORS origin from environment variable or use a default value in development
  const allowedOrigin = process.env.CORS_ORIGIN || '*';
  
  // Check if the request has an Origin header
  const origin = req.headers.origin;
  
  // Set CORS headers if Origin is present
  if (origin) {
    // If using a wildcard, or if the origin matches allowed origin
    if (allowedOrigin === '*' || origin === allowedOrigin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
  }
  
  // Set other CORS headers
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
}; 