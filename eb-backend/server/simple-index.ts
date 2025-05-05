import express from "express";
import { registerRoutes } from "./simple-routes";
import dotenv from 'dotenv';
import { checkDatabaseConnection, resetDatabaseConnection } from "./db";
import { Request as ExpressRequest, Response, NextFunction } from 'express';
import { Server } from 'http';

// Extend the Express Request interface to include requestId
interface CustomRequest extends ExpressRequest {
  requestId?: string;
}

// Load environment variables from .env file
dotenv.config();

// Add startup logging
console.log("Starting application...");
console.log(`NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
console.log(`PORT: ${process.env.PORT || '8081'}`);
console.log(`DATABASE_URL: ${process.env.DATABASE_URL ? 'Set (hidden for security)' : 'Not set'}`);

// Process uncaught exceptions to prevent crashing
process.on('uncaughtException', (error) => {
  console.error('UNCAUGHT EXCEPTION:', error);
  // Don't exit the process in production
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION:', reason);
});

const app = express();

// Increase the timeout for the server
const SERVER_TIMEOUT = 120000; // 2 minutes

// Add basic security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
});

// Add request body size limits
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false, limit: '2mb' }));

// Add a direct health check endpoint that doesn't rely on database
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Request logging middleware with additional details
app.use((req: CustomRequest, res: Response, next: NextFunction) => {
  const start = Date.now();
  const path = req.path;
  const method = req.method;
  
  // Generate a request ID
  const requestId = Math.random().toString(36).substring(2, 15);
  
  // Add request ID to request object for use in other middleware
  req.requestId = requestId;
  
  // Add correlation ID header to response
  res.setHeader('X-Request-ID', requestId);
  
  console.log(`[${requestId}] ${method} ${path} - Request started [${req.ip}]`);

  // Monitor for timeouts
  const timeoutCheck = setTimeout(() => {
    console.warn(`[${requestId}] ${method} ${path} - Still processing after 10s`);
  }, 10000);

  res.on("finish", () => {
    clearTimeout(timeoutCheck);
    const duration = Date.now() - start;
    console.log(`[${requestId}] ${method} ${path} ${res.statusCode} - Completed in ${duration}ms`);
  });

  res.on("close", () => {
    clearTimeout(timeoutCheck);
    if (!res.writableEnded) {
      console.warn(`[${requestId}] ${method} ${path} - Connection closed before response completed`);
    }
  });

  next();
});

// Global error handler for database connection issues
app.use((err: any, req: ExpressRequest, res: Response, next: NextFunction) => {
  if (err && err.code === 'ECONNREFUSED') {
    console.error('Database connection error:', err);
    return res.status(503).json({ 
      error: 'Database connection failed', 
      message: 'The application is currently unable to connect to the database'
    });
  }
  next(err);
});

// Recovery middleware for unexpected errors
app.use((err: any, req: ExpressRequest, res: Response, next: NextFunction) => {
  console.error('Middleware error caught:', err);
  if (!res.headersSent) {
    res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'production' 
        ? 'An unexpected error occurred' 
        : err.message
    });
  }
  next(err);
});

(async () => {
  try {
    // Check database connection before starting the server
    console.log("Checking database connection...");
    const isConnected = await checkDatabaseConnection();
    if (!isConnected) {
      console.warn("⚠️ WARNING: Database connection failed. Using in-memory storage instead.");
      // Continue anyway since we have in-memory fallback
    } else {
      console.log("✅ Database connection successful.");
    }

    console.log("Registering routes...");
    const server = await registerRoutes(app);
    
    // Set server timeout
    server.timeout = SERVER_TIMEOUT;
    
    // Add periodic connection check and reset
    setInterval(async () => {
      const isConnected = await checkDatabaseConnection();
      if (!isConnected) {
        console.warn("Periodic check: Database connection lost, attempting reset...");
        await resetDatabaseConnection();
      }
    }, 60000); // Check every minute

    // Use PORT environment variable with fallback to 8081
    const port = process.env.PORT || 8081;
    server.listen(port, () => {
      console.log(`Server listening on port ${port} in ${process.env.NODE_ENV || 'development'} mode`);
      console.log(`Health check endpoint: http://localhost:${port}/health`);
      console.log(`Database health check endpoint: http://localhost:${port}/db-health`);
    });
    
    // Add graceful shutdown handlers
    process.on('SIGTERM', () => gracefulShutdown(server, 'SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown(server, 'SIGINT'));
    
  } catch (error) {
    console.error("Failed to start server:", error);
    // For Elastic Beanstalk deployments, we don't want to exit the process
    // as that will cause the instance to be marked as unhealthy
    if (process.env.NODE_ENV !== 'production') {
      process.exit(1);
    }
  }
})();

// Helper function for graceful shutdown
function gracefulShutdown(server: Server, signal: string) {
  console.log(`Received ${signal}, starting graceful shutdown...`);
  
  // First stop accepting new connections
  server.close((err) => {
    if (err) {
      console.error('Error during server close:', err);
      process.exit(1);
    }
    
    console.log('HTTP server closed. Exiting process.');
    process.exit(0);
  });
  
  // Force close after timeout
  setTimeout(() => {
    console.error('Forcing shutdown after timeout');
    process.exit(1);
  }, 30000); // 30 second timeout
} 