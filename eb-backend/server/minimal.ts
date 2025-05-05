import express from 'express';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 8081;

// Simple health check endpoint
app.get('/', (req, res) => {
  res.send({
    status: 'ok',
    message: 'Server is running',
    port: port,
    env: process.env.NODE_ENV
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server listening on port ${port} in ${process.env.NODE_ENV} mode`);
}); 