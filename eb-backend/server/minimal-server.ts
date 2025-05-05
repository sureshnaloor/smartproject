import express from 'express';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
app.use(express.json());

// Add a health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    message: 'Server is running correctly'
  });
});

// Add a simple API endpoint
app.get('/api/info', (req, res) => {
  res.json({
    appName: 'Smart Construction Backend',
    version: '1.0.0',
    environment: process.env.NODE_ENV,
    port: process.env.PORT
  });
});

// Start the server
const port = process.env.PORT || 8081;
app.listen(port, () => {
  console.log(`Server listening on port ${port} in ${process.env.NODE_ENV || 'development'} mode`);
}); 