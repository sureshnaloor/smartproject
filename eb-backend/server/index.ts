import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Add startup logging
console.log("Starting application...");
console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`PORT: ${process.env.PORT}`);

// Process uncaught exceptions to prevent crashing
process.on('uncaughtException', (error) => {
  console.error('UNCAUGHT EXCEPTION:', error);
  // Don't exit the process in production
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
});

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Add a simple health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    console.log("Registering routes...");
    const server = await registerRoutes(app);

    // Add a catch-all route for client-side routing before the error handler
    app.get([
      '/',
      '/projects/:projectId',
      '/projects/:projectId/wbs',
      '/projects/:projectId/schedule',
      '/projects/:projectId/costs',
      '/projects/:projectId/reports',
      '/projects/:projectId/*',
    ], (_req, res, next) => {
      if (_req.path.startsWith('/api')) {
        return next();
      }
      
      // For all client routes, pass through to Vite or static serving
      next();
    });
    
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      
      console.error(`ERROR [${status}]: ${message}`, err);
      res.status(status).json({ message });
    });

    // importantly only setup vite in development and after
    // setting up all the other routes so the catch-all route
    // doesn't interfere with the other routes
    if (app.get("env") === "development") {
      console.log("Setting up Vite for development...");
      await setupVite(app, server);
    } else {
      console.log("Setting up static file serving for production...");
      serveStatic(app);
    }

    // Use PORT environment variable with fallback to 3001
    const port = process.env.PORT || 3001;
    server.listen(port, () => {
      console.log(`Server listening on port ${port} in ${process.env.NODE_ENV} mode`);
      log(`serving on port ${port}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    // For Elastic Beanstalk deployments, we don't want to exit the process
    // as that will cause the instance to be marked as unhealthy
    if (process.env.NODE_ENV !== 'production') {
      process.exit(1);
    }
  }
})();
