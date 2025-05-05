import { Request, Response } from 'express';
import { checkDatabaseConnection } from './db';
import os from 'os';

/**
 * Health check endpoint that provides detailed system status
 */
export const healthCheck = async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  // Basic system info
  const systemInfo = {
    uptime: Math.floor(process.uptime()),
    memoryUsage: process.memoryUsage(),
    freeMemory: os.freemem(),
    totalMemory: os.totalmem(),
    cpuLoad: os.loadavg(),
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development'
  };

  try {
    // Check database connection
    console.log("Health check: Testing database connection...");
    const dbConnected = await Promise.race([
      checkDatabaseConnection(),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 5000))
    ]);

    // Calculate response time
    const responseTime = Date.now() - startTime;

    const healthStatus = {
      status: dbConnected ? 'healthy' : 'degraded',
      database: {
        connected: dbConnected,
        connectionAttempted: true
      },
      system: systemInfo,
      responseTime: `${responseTime}ms`
    };

    // Set appropriate status code
    const statusCode = dbConnected ? 200 : 200; // Always return 200 for Elastic Beanstalk health check
    
    // Log health check results
    console.log(`Health check result: ${healthStatus.status} (${responseTime}ms)`);
    
    // Return health status
    return res.status(statusCode).json(healthStatus);
  } catch (error) {
    console.error("Health check failed:", error);
    
    // Still return 200 to prevent Elastic Beanstalk from terminating the instance
    // but indicate the error
    return res.status(200).json({
      status: 'degraded',
      error: error instanceof Error ? error.message : 'Unknown error',
      system: systemInfo,
      responseTime: `${Date.now() - startTime}ms`
    });
  }
};

/**
 * Minimal health check for AWS ELB health checks
 * This should always return 200 OK
 */
export const simpleHealthCheck = (req: Request, res: Response) => {
  res.status(200).send('OK');
}; 