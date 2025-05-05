import express from "express";
import { createServer } from "http";
import { simpleHealthCheck, healthCheck } from "./healthcheck";

const app = express();
const PORT = process.env.PORT || 8081;

// Add basic security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
});

// Add CORS support
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Add request body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

// Add simple logging
app.use((req, res, next) => {
  const start = Date.now();
  console.log(`${req.method} ${req.path} - Request started`);
  
  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} ${res.statusCode} - Completed in ${duration}ms`);
  });
  
  next();
});

// Root route for basic check
app.get('/', (req, res) => {
  res.status(200).send('Server is running');
});

// Simple health check for ELB
app.get('/health', simpleHealthCheck);

// Detailed health check for diagnostics
app.get('/health-check', healthCheck);

// API routes
app.get('/api/info', (req, res) => {
  res.json({
    name: 'Smart Construction API',
    version: '1.0.0',
    status: 'minimal mode',
    timestamp: new Date().toISOString()
  });
});

// Basic error handler
app.use((err: any, req: any, res: any, next: any) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message
  });
});

// Start the server
const server = createServer(app);
server.listen(PORT, () => {
  console.log(`Minimal server running on port ${PORT}`);
}); 