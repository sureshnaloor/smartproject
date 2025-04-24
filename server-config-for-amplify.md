# Express Server Configuration for AWS Amplify

When deploying an Express server to AWS Amplify, there are some important configurations you need to make in your server code to ensure it works correctly.

## Port Configuration

AWS Amplify requires your server to listen on the port provided by the environment variable `PORT`. Update your server code as follows:

```javascript
// server/index.ts or similar file
import express from 'express';
// ... other imports

const app = express();
// ... your middleware and route setup

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

## CORS Configuration

If your frontend is making API calls to your Express backend, you'll need proper CORS configuration:

```javascript
import cors from 'cors';

// Basic CORS setup
app.use(cors());

// OR more specific configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? 'https://your-amplify-domain.amplifyapp.com' 
    : 'http://localhost:3000',
  credentials: true
}));
```

## Health Check Endpoint

AWS Amplify performs health checks to ensure your application is running. Add a health check endpoint:

```javascript
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});
```

## Static File Serving

For a full-stack application, configure your Express server to serve the Vite-built frontend files:

```javascript
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static files from the Vite build directory
app.use(express.static(path.join(__dirname, '../')));

// Handle SPA routing - send all non-API requests to the frontend
app.get('*', (req, res, next) => {
  // Skip API routes
  if (req.path.startsWith('/api')) {
    return next();
  }
  // Serve the index.html for client-side routing
  res.sendFile(path.join(__dirname, '../index.html'));
});
```

## Environment Variables

Make sure your server can access environment variables:

```javascript
import dotenv from 'dotenv';

// Load environment variables from .env file in development
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}
```

## Error Handling

Implement proper error handling for production:

```javascript
// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send({
    message: process.env.NODE_ENV === 'production' 
      ? 'Internal Server Error' 
      : err.message
  });
});
```

## Logging

Consider implementing proper logging for production:

```javascript
import morgan from 'morgan';

// Use appropriate logging format based on environment
if (process.env.NODE_ENV === 'production') {
  app.use(morgan('combined'));
} else {
  app.use(morgan('dev'));
}
```

## Session Configuration

If using sessions, ensure they're configured for production:

```javascript
import session from 'express-session';
import MemoryStore from 'memorystore';

const MemoryStoreSession = MemoryStore(session);

app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  },
  store: new MemoryStoreSession({
    checkPeriod: 86400000 // Prune expired entries every 24h
  })
}));
```

Implementing these configurations will help ensure your Express server runs correctly when deployed to AWS Amplify. 