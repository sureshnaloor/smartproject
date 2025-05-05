import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./simple-storage";
import { checkDatabaseConnection, resetDatabaseConnection } from "./db";

// Create an inline implementation for cors
const cors = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  };
};

// Create an inline error handler
const handleError = (err: unknown, res: Response) => {
  console.error("Server error:", err);
  
  if (err instanceof Error) {
    return res.status(400).json({ message: err.message });
  }
  
  return res.status(500).json({ message: "An unexpected error occurred" });
};

// Add a timeout protection utility
const withTimeout = <T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> => {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Operation timed out: ${errorMessage}`));
    }, timeoutMs);
    
    promise
      .then((result) => {
        clearTimeout(timeout);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeout);
        reject(error);
      });
  });
};

// Add request tracking middleware
const requestTracker = () => {
  const activeRequests = new Map<string, { startTime: number, path: string }>();
  
  // Set a monitoring interval to detect long-running requests
  setInterval(() => {
    const now = Date.now();
    activeRequests.forEach((request, id) => {
      const duration = now - request.startTime;
      if (duration > 10000) { // 10 seconds
        console.warn(`Request ${id} to ${request.path} has been running for ${duration}ms`);
      }
    });
  }, 10000); // Check every 10 seconds
  
  return (req: Request, res: Response, next: NextFunction) => {
    const requestId = Math.random().toString(36).substring(2, 15);
    
    console.log(`[${requestId}] ${req.method} ${req.path} - Request started`);
    
    activeRequests.set(requestId, { 
      startTime: Date.now(),
      path: req.path
    });
    
    res.on('finish', () => {
      const duration = Date.now() - activeRequests.get(requestId)?.startTime!;
      console.log(`[${requestId}] ${req.method} ${req.path} ${res.statusCode} - Completed in ${duration}ms`);
      activeRequests.delete(requestId);
    });
    
    res.on('close', () => {
      if (!res.writableEnded) {
        console.warn(`[${requestId}] ${req.method} ${req.path} - Client closed connection prematurely`);
      }
      activeRequests.delete(requestId);
    });
    
    // Set a response timeout - default to 30 seconds
    // This ensures the server always responds and doesn't hang
    req.setTimeout(30000, () => {
      console.error(`[${requestId}] ${req.method} ${req.path} - Request timeout`);
      if (!res.headersSent) {
        res.status(504).json({
          message: "Request timed out",
          path: req.path,
          method: req.method
        });
      }
      activeRequests.delete(requestId);
    });
    
    next();
  };
};

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Middleware
  app.use(cors());
  app.use(requestTracker());

  // Health check endpoint
  app.get("/health", (req: Request, res: Response) => {
    res.status(200).json({
      status: "ok",
      timestamp: new Date().toISOString()
    });
  });

  // Add a database health check endpoint
  app.get("/db-health", async (req: Request, res: Response) => {
    try {
      const isConnected = await withTimeout(
        checkDatabaseConnection(),
        5000,
        "Database health check timeout"
      );
      
      if (isConnected) {
        return res.status(200).json({ 
          status: 'connected', 
          timestamp: new Date().toISOString() 
        });
      } else {
        return res.status(503).json({ 
          status: 'disconnected', 
          timestamp: new Date().toISOString(),
          message: 'Database connection failed, using fallback storage'
        });
      }
    } catch (error) {
      console.error("Database health check failed:", error);
      return res.status(500).json({ 
        status: 'error', 
        message: error instanceof Error ? error.message : 'Unknown database error',
        timestamp: new Date().toISOString() 
      });
    }
  });

  // API info endpoint
  app.get("/api/info", (req: Request, res: Response) => {
    res.json({
      apiName: "Smart Construction API",
      version: "1.0.0",
      environment: process.env.NODE_ENV || "development",
      timestamp: new Date().toISOString()
    });
  });

  // Projects endpoints
  app.get("/api/projects", async (req: Request, res: Response) => {
    const requestId = Math.random().toString(36).substring(2, 10);
    console.log(`[${requestId}] GET /api/projects - Starting request`);
    
    try {
      // Wrap the storage call with a timeout
      const projects = await withTimeout(
        Promise.resolve(storage.getProjects()),
        15000, // 15 second timeout (increased from 5)
        "Fetching projects took too long"
      );
      
      console.log(`[${requestId}] GET /api/projects - Retrieved ${projects.length} projects`);
      return res.json(projects);
    } catch (err) {
      console.error(`[${requestId}] GET /api/projects - Error:`, err);
      
      if (err instanceof Error && err.message.includes('timeout')) {
        return res.status(504).json({ 
          message: "Request timed out when fetching projects", 
          requestId 
        });
      }
      
      handleError(err, res);
    }
  });

  app.get("/api/projects/:id", (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      const project = storage.getProject(id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      res.json(project);
    } catch (err) {
      handleError(err, res);
    }
  });

  app.post("/api/projects", (req: Request, res: Response) => {
    try {
      console.log("Creating project with data:", JSON.stringify(req.body));
      const projectData = req.body;
      if (!projectData.name || !projectData.startDate || !projectData.endDate) {
        return res.status(400).json({ 
          message: "Missing required fields: name, startDate, and endDate are required" 
        });
      }

      // Create project
      const project = storage.createProject(projectData);

      // Create default top-level WBS items for the project
      const totalBudget = Number(project.budget) || 100000;
      const startDate = new Date(project.startDate);
      const endDate = new Date(project.endDate);
      
      const topLevelWbsItems = [
        {
          projectId: project.id,
          parentId: null,
          name: "Engineering & Design",
          level: 1,
          code: "1",
          type: "Summary",
          budgetedCost: totalBudget * 0.05, // 5% of total budget
          isTopLevel: true,
          description: "Engineering and design phase",
          startDate: startDate,
          endDate: endDate,
          duration: Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
        },
        {
          projectId: project.id,
          parentId: null,
          name: "Procurement & Construction",
          level: 1,
          code: "2",
          type: "Summary",
          budgetedCost: totalBudget * 0.85, // 85% of total budget
          isTopLevel: true,
          description: "Procurement and construction phase",
          startDate: startDate,
          endDate: endDate,
          duration: Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
        },
        {
          projectId: project.id,
          parentId: null,
          name: "Testing & Commissioning",
          level: 1,
          code: "3",
          type: "Summary",
          budgetedCost: totalBudget * 0.10, // 10% of total budget
          isTopLevel: true,
          description: "Testing and commissioning phase",
          startDate: startDate,
          endDate: endDate,
          duration: Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
        }
      ];

      for (const wbsItem of topLevelWbsItems) {
        storage.createWbsItem(wbsItem);
      }

      res.status(201).json(project);
    } catch (err) {
      handleError(err, res);
    }
  });

  app.patch("/api/projects/:id", (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      const project = storage.getProject(id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const projectData = req.body;
      const updatedProject = storage.updateProject(id, projectData);
      
      res.json(updatedProject);
    } catch (err) {
      handleError(err, res);
    }
  });

  app.delete("/api/projects/:id", (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      const project = storage.getProject(id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      storage.deleteProject(id);
      res.status(204).end();
    } catch (err) {
      handleError(err, res);
    }
  });

  // WBS Items endpoints
  app.get("/api/projects/:id/wbs", (req: Request, res: Response) => {
    try {
      const projectId = parseInt(req.params.id);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      const wbsItems = storage.getWbsItems(projectId);
      res.json(wbsItems);
    } catch (err) {
      handleError(err, res);
    }
  });

  app.get("/api/wbs/:id", (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid WBS ID" });
      }

      const wbsItem = storage.getWbsItem(id);
      if (!wbsItem) {
        return res.status(404).json({ message: "WBS item not found" });
      }

      res.json(wbsItem);
    } catch (err) {
      handleError(err, res);
    }
  });

  app.post("/api/wbs", (req: Request, res: Response) => {
    try {
      console.log("Creating WBS item with data:", JSON.stringify(req.body));
      const wbsData = req.body;
      if (!wbsData.name || !wbsData.projectId) {
        return res.status(400).json({ 
          message: "Missing required fields: at least name and projectId are required" 
        });
      }

      const wbsItem = storage.createWbsItem(wbsData);
      res.status(201).json(wbsItem);
    } catch (err) {
      handleError(err, res);
    }
  });

  app.patch("/api/wbs/:id", (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid WBS ID" });
      }

      const wbsItem = storage.getWbsItem(id);
      if (!wbsItem) {
        return res.status(404).json({ message: "WBS item not found" });
      }

      const wbsData = req.body;
      const updatedWbsItem = storage.updateWbsItem(id, wbsData);
      
      res.json(updatedWbsItem);
    } catch (err) {
      handleError(err, res);
    }
  });

  app.patch("/api/wbs/:id/progress", (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid WBS ID" });
      }

      const wbsItem = storage.getWbsItem(id);
      if (!wbsItem) {
        return res.status(404).json({ message: "WBS item not found" });
      }

      // Simple validation
      if (wbsItem.type !== "Activity" && (req.body.actualStartDate || req.body.actualEndDate)) {
        return res.status(400).json({
          message: "Only 'Activity' items can have actual start and end dates"
        });
      }

      // Update WBS item progress
      const progressData = {
        percentComplete: req.body.percentComplete || 0,
        actualStartDate: req.body.actualStartDate ? new Date(req.body.actualStartDate) : null,
        actualEndDate: req.body.actualEndDate ? new Date(req.body.actualEndDate) : null
      };

      const updatedWbsItem = storage.updateWbsItem(id, progressData);
      res.json(updatedWbsItem);
    } catch (err) {
      handleError(err, res);
    }
  });

  app.delete("/api/wbs/:id", (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid WBS ID" });
      }

      const wbsItem = storage.getWbsItem(id);
      if (!wbsItem) {
        return res.status(404).json({ message: "WBS item not found" });
      }

      // Don't allow deletion of top-level WBS items
      if (wbsItem.isTopLevel) {
        return res.status(400).json({ message: "Cannot delete top-level WBS items" });
      }

      // Delete the WBS item
      storage.deleteWbsItem(id);
      res.status(204).end();
    } catch (err) {
      handleError(err, res);
    }
  });

  // Tasks endpoints
  app.get("/api/projects/:id/tasks", (req: Request, res: Response) => {
    try {
      const projectId = parseInt(req.params.id);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      const tasks = storage.getTasks(projectId);
      res.json(tasks);
    } catch (err) {
      handleError(err, res);
    }
  });

  app.post("/api/tasks", (req: Request, res: Response) => {
    try {
      console.log("Creating task with data:", JSON.stringify(req.body));
      const taskData = req.body;
      if (!taskData.name || !taskData.activityId) {
        return res.status(400).json({ 
          message: "Missing required fields: name and activityId are required" 
        });
      }

      // Check if activity exists and is of type Activity
      const activity = storage.getWbsItem(taskData.activityId);
      if (!activity) {
        return res.status(404).json({ message: "Activity not found" });
      }
      
      if (activity.type !== "Activity") {
        return res.status(400).json({ message: "Tasks can only be attached to activities" });
      }
      
      // Set project ID from activity
      taskData.projectId = activity.projectId;

      const task = storage.createTask(taskData);
      res.status(201).json(task);
    } catch (err) {
      handleError(err, res);
    }
  });

  // Dependencies endpoints (simplified)
  app.get("/api/projects/:projectId/dependencies", (req: Request, res: Response) => {
    try {
      const projectId = parseInt(req.params.projectId);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      // Return empty array as we don't have dependencies in the mock data
      res.json([]);
    } catch (err) {
      handleError(err, res);
    }
  });

  // Cost entries endpoints (simplified)
  app.get("/api/wbs/:wbsItemId/costs", (req: Request, res: Response) => {
    try {
      const wbsItemId = parseInt(req.params.wbsItemId);
      if (isNaN(wbsItemId)) {
        return res.status(400).json({ message: "Invalid WBS item ID" });
      }

      // Return empty array as we don't have cost entries in the mock data
      res.json([]);
    } catch (err) {
      handleError(err, res);
    }
  });

  // Add a catch-all route for client-side routing before the error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    
    console.error(`ERROR [${status}]: ${message}`, err);
    res.status(status).json({ message });
  });

  return httpServer;
} 