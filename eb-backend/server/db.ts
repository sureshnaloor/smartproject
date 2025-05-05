import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../shared/schema";
import postgres from "postgres";
import dotenv from 'dotenv';

// Ensure environment variables are loaded
dotenv.config();

// Check for DATABASE_URL environment variable
if (!process.env.DATABASE_URL) {
  console.warn("DATABASE_URL not set. Database connections will fail.");
}

// Log database connection attempt (without exposing credentials)
console.log("Initializing database connection...");

// Connection options with better defaults for Elastic Beanstalk
const connectionOptions = {
  ssl: { rejectUnauthorized: false },
  max: 10, // Increased from 5 to 10 for better handling of concurrent requests
  idle_timeout: 30, // Increased from 20 to 30 seconds
  connect_timeout: 15, // Increased from 10 to 15 seconds
  max_lifetime: 60 * 60, // Increased from 30 minutes to 60 minutes
  debug: process.env.NODE_ENV !== 'production',
  application_name: 'smartconstruct', // Add application name for better logging
  onnotice: (notice: any) => {
    console.log("Database notice:", notice.message);
  },
  onparameter: (key: string, value: string) => {
    console.log(`Database parameter: ${key}=${value}`);
  },
  // Add connection error handling
  onconnect: () => {
    console.log("Database connected successfully");
    connectionAttempts = 0; // Reset connection attempts on successful connection
  },
  onerror: (err: Error) => {
    console.error("Database connection error:", err);
  }
};

// Configure retry logic
let connectionAttempts = 0;
const MAX_CONNECTION_ATTEMPTS = 5; // Increased from 3 to 5
const RETRY_DELAY = 3000; // Increased from 2000 to 3000 milliseconds

// Create a function to initialize the client
const createClient = () => {
  const connectionString = process.env.DATABASE_URL || '';
  return postgres(connectionString, connectionOptions);
};

// Initialize the client
let client = createClient();

// Create a Drizzle ORM instance
export const db = drizzle(client, { schema });

// Export a function to check database connectivity with retry logic
export const checkDatabaseConnection = async (): Promise<boolean> => {
  connectionAttempts = 0;
  return attemptConnection();
};

// Helper function to attempt connection with retry
const attemptConnection = async (): Promise<boolean> => {
  try {
    // Simple query to check connectivity
    connectionAttempts++;
    console.log(`Database connection attempt ${connectionAttempts}/${MAX_CONNECTION_ATTEMPTS}...`);
    
    // Set a timeout for the query to avoid hanging
    const timeoutPromise = new Promise<any>((_, reject) => {
      setTimeout(() => reject(new Error("Database connection timeout")), 8000); // Increased from 5000 to 8000
    });
    
    // Execute the query
    const resultPromise = client`SELECT 1 as connected`;
    const result = await Promise.race([resultPromise, timeoutPromise]);
    
    console.log("Database connection successful");
    return result[0]?.connected === 1;
  } catch (error) {
    console.error("Database connection failed:", error);
    
    // Retry logic
    if (connectionAttempts < MAX_CONNECTION_ATTEMPTS) {
      const backoffDelay = RETRY_DELAY * Math.pow(1.5, connectionAttempts - 1); // Exponential backoff
      const jitter = Math.floor(Math.random() * 1000); // Add jitter to prevent thundering herd
      const totalDelay = backoffDelay + jitter;
      
      console.log(`Retrying database connection in ${totalDelay / 1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, totalDelay));
      return attemptConnection();
    }
    
    // If using in-memory fallback is acceptable, return false instead of throwing
    console.warn("All database connection attempts failed. Using in-memory storage fallback.");
    return false;
  }
};

// Add a new function to get a query with timeout
export const queryWithTimeout = async <T>(query: Promise<T>, timeoutMs = 10000, operationName = 'database query'): Promise<T> => {
  const timeoutPromise = new Promise<T>((_, reject) => {
    setTimeout(() => reject(new Error(`Timeout: ${operationName} took longer than ${timeoutMs}ms`)), timeoutMs);
  });
  
  try {
    return await Promise.race([query, timeoutPromise]);
  } catch (error) {
    console.error(`Query timeout (${operationName}):`, error);
    
    // Check if we need to reset the connection
    if (connectionAttempts > 0) {
      await resetDatabaseConnection();
    }
    
    throw error;
  }
};

// Function to reset the connection if needed
export const resetDatabaseConnection = async (): Promise<void> => {
  try {
    console.log("Resetting database connection...");
    // Close the existing client with a short timeout
    await client.end({ timeout: 8 }); // Increased from 5 to 8 seconds
    // Create a new client
    client = createClient();
    // Update the db instance
    (db as any).client = client;
    console.log("Database connection reset successfully");
  } catch (error) {
    console.error("Failed to reset database connection:", error);
    // Force recreation anyway
    client = createClient();
    (db as any).client = client;
  }
};

// Handle process termination
process.on('SIGINT', async () => {
  console.log("Process terminating, closing database connections...");
  try {
    await client.end({ timeout: 5 });
    console.log("Database connections closed");
    process.exit(0);
  } catch (error) {
    console.error("Error closing database connections:", error);
    process.exit(1);
  }
});
