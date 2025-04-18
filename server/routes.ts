import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertProjectSchema, insertWbsItemSchema, insertDependencySchema, insertCostEntrySchema, updateWbsProgressSchema, csvImportSchema } from "@shared/schema";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Error handling middleware
  const handleError = (err: unknown, res: Response) => {
    console.error(err);
    
    if (err instanceof ZodError) {
      return res.status(400).json({ 
        message: "Validation error", 
        errors: fromZodError(err).message
      });
    }
    
    return res.status(500).json({ message: "Internal server error" });
  };

  // Project routes
  app.get("/api/projects", async (req: Request, res: Response) => {
    try {
      const projects = await storage.getProjects();
      res.json(projects);
    } catch (err) {
      handleError(err, res);
    }
  });

  app.get("/api/projects/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      const project = await storage.getProject(id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      res.json(project);
    } catch (err) {
      handleError(err, res);
    }
  });

  app.post("/api/projects", async (req: Request, res: Response) => {
    try {
      const projectData = insertProjectSchema.parse(req.body);
      const project = await storage.createProject(projectData);
      
      // Create default top-level WBS items for the project - now all will be Summary type
      const totalBudget = Number(project.budget);
      const startDate = new Date(project.startDate);
      const endDate = new Date(project.endDate);
      
      const topLevelWbsItems = [
        {
          projectId: project.id,
          parentId: null,
          name: "Engineering & Design",
          level: 1,
          code: "1",
          type: "Summary" as const,  // Use const assertion to fix type error
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
          type: "Summary" as const,  // Use const assertion to fix type error
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
          type: "Summary" as const,  // Use const assertion to fix type error
          budgetedCost: totalBudget * 0.10, // 10% of total budget
          isTopLevel: true,
          description: "Testing and commissioning phase",
          startDate: startDate,
          endDate: endDate,
          duration: Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
        }
      ];

      for (const wbsItem of topLevelWbsItems) {
        await storage.createWbsItem(wbsItem);
      }

      res.status(201).json(project);
    } catch (err) {
      handleError(err, res);
    }
  });

  app.patch("/api/projects/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      const project = await storage.getProject(id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Create a partial schema for the project update
      const partialProjectSchema = z.object({
        name: z.string().optional(),
        description: z.string().nullable().optional(),
        budget: z.number().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional()
      });

      const projectData = partialProjectSchema.parse(req.body);
      const updatedProject = await storage.updateProject(id, projectData);
      
      res.json(updatedProject);
    } catch (err) {
      handleError(err, res);
    }
  });

  app.delete("/api/projects/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      const project = await storage.getProject(id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      await storage.deleteProject(id);
      res.status(204).end();
    } catch (err) {
      handleError(err, res);
    }
  });

  // WBS routes
  app.get("/api/projects/:projectId/wbs", async (req: Request, res: Response) => {
    try {
      const projectId = parseInt(req.params.projectId);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const wbsItems = await storage.getWbsItems(projectId);
      res.json(wbsItems);
    } catch (err) {
      handleError(err, res);
    }
  });

  app.get("/api/wbs/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid WBS item ID" });
      }

      const wbsItem = await storage.getWbsItem(id);
      if (!wbsItem) {
        return res.status(404).json({ message: "WBS item not found" });
      }

      res.json(wbsItem);
    } catch (err) {
      handleError(err, res);
    }
  });

  app.post("/api/wbs", async (req: Request, res: Response) => {
    try {
      const wbsItemData = insertWbsItemSchema.parse(req.body);
      
      // Validate that the project exists
      const project = await storage.getProject(wbsItemData.projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Apply additional business rules for WBS hierarchy
      
      // Rule 1: Top-level items must be Summary
      if (!wbsItemData.parentId && wbsItemData.type !== "Summary") {
        return res.status(400).json({ 
          message: "Top-level WBS items must be of type 'Summary'"
        });
      }

      // Rule 2: If parent exists, validate parent-child type relationships
      if (wbsItemData.parentId) {
        const parentWbsItem = await storage.getWbsItem(wbsItemData.parentId);
        if (!parentWbsItem) {
          return res.status(404).json({ message: "Parent WBS item not found" });
        }

        // Rule 2a: If parent is Summary, child can be either WorkPackage or Summary
        if (parentWbsItem.type === "Summary") {
          if (wbsItemData.type === "Activity") {
            return res.status(400).json({
              message: "A 'Summary' WBS item cannot have an 'Activity' as a direct child. It must have a 'WorkPackage' in between."
            });
          }
        }
        // Rule 2b: If parent is WorkPackage, child can only be Activity
        else if (parentWbsItem.type === "WorkPackage") {
          if (wbsItemData.type !== "Activity") {
            return res.status(400).json({
              message: "A 'WorkPackage' can only have 'Activity' items as children"
            });
          }
        }
        // Rule 2c: Activity cannot have children
        else if (parentWbsItem.type === "Activity") {
          return res.status(400).json({
            message: "An 'Activity' item cannot have children"
          });
        }

        // Rule 3: Check if creating a WorkPackage under a non-top-level Summary
        if (wbsItemData.type === "WorkPackage" && parentWbsItem.type === "Summary" && !parentWbsItem.isTopLevel) {
          // Check if there's already a WorkPackage in the hierarchy between top level and this item
          const projectWbsItems = await storage.getWbsItems(wbsItemData.projectId);
          const hasWorkPackageInPath = checkForWorkPackageInPath(projectWbsItems, parentWbsItem);
          
          if (hasWorkPackageInPath) {
            return res.status(400).json({
              message: "Cannot create a 'WorkPackage' at this level. Only one level of 'WorkPackage' is allowed in the hierarchy."
            });
          }
        }
      }

      const wbsItem = await storage.createWbsItem(wbsItemData);
      res.status(201).json(wbsItem);
    } catch (err) {
      handleError(err, res);
    }
  });

  app.patch("/api/wbs/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid WBS item ID" });
      }

      const wbsItem = await storage.getWbsItem(id);
      if (!wbsItem) {
        return res.status(404).json({ message: "WBS item not found" });
      }

      // Use z.object to create a partial schema for validation
      const partialWbsSchema = z.object({
        projectId: z.number().optional(),
        parentId: z.number().nullable().optional(),
        name: z.string().optional(),
        description: z.string().nullable().optional(),
        level: z.number().optional(),
        code: z.string().optional(),
        type: z.enum(["Summary", "WorkPackage", "Activity"]).optional(),
        budgetedCost: z.number().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        duration: z.number().optional(),
        isTopLevel: z.boolean().optional(),
      });
      
      const wbsItemData = partialWbsSchema.parse(req.body);
      
      // If changing type, apply the same business rules
      if (wbsItemData.type && wbsItemData.type !== wbsItem.type) {
        // Top-level items must be Summary
        if (wbsItem.isTopLevel && wbsItemData.type !== "Summary") {
          return res.status(400).json({ 
            message: "Top-level WBS items must be of type 'Summary'"
          });
        }

        // Check parent-child type relationships if changing type
        if (wbsItem.parentId) {
          const parentWbsItem = await storage.getWbsItem(wbsItem.parentId);
          if (!parentWbsItem) {
            return res.status(404).json({ message: "Parent WBS item not found" });
          }

          // Apply same rules as in the POST endpoint
          if (parentWbsItem.type === "Summary") {
            if (wbsItemData.type === "Activity") {
              return res.status(400).json({
                message: "A 'Summary' WBS item cannot have an 'Activity' as a direct child. It must have a 'WorkPackage' in between."
              });
            }
          } else if (parentWbsItem.type === "WorkPackage") {
            if (wbsItemData.type !== "Activity") {
              return res.status(400).json({
                message: "A 'WorkPackage' can only have 'Activity' items as children"
              });
            }
          }
        }

        // Check for children compatibility with new type
        const projectWbsItems = await storage.getWbsItems(wbsItem.projectId);
        const children = projectWbsItems.filter(item => item.parentId === wbsItem.id);
        
        if (children.length > 0) {
          if (wbsItemData.type === "Activity") {
            return res.status(400).json({
              message: "Cannot change to 'Activity' type because this item has children. 'Activity' items cannot have children."
            });
          }

          if (wbsItemData.type === "WorkPackage") {
            const hasNonActivityChildren = children.some(child => child.type !== "Activity");
            if (hasNonActivityChildren) {
              return res.status(400).json({
                message: "Cannot change to 'WorkPackage' type because this item has non-Activity children. 'WorkPackage' items can only have 'Activity' children."
              });
            }
          }
        }
      }

      const updatedWbsItem = await storage.updateWbsItem(id, wbsItemData);
      
      res.json(updatedWbsItem);
    } catch (err) {
      handleError(err, res);
    }
  });

  app.patch("/api/wbs/:id/progress", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid WBS item ID" });
      }

      const wbsItem = await storage.getWbsItem(id);
      if (!wbsItem) {
        return res.status(404).json({ message: "WBS item not found" });
      }

      // Only Activity items should have progress updated with dates
      if (wbsItem.type !== "Activity" && (req.body.actualStartDate || req.body.actualEndDate)) {
        return res.status(400).json({
          message: "Only 'Activity' items can have actual start and end dates"
        });
      }

      const progressData = updateWbsProgressSchema.parse({ id, ...req.body });
      const updatedWbsItem = await storage.updateWbsProgress(id, progressData);
      
      res.json(updatedWbsItem);
    } catch (err) {
      handleError(err, res);
    }
  });

  app.delete("/api/wbs/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid WBS item ID" });
      }

      const wbsItem = await storage.getWbsItem(id);
      if (!wbsItem) {
        return res.status(404).json({ message: "WBS item not found" });
      }

      // Don't allow deletion of top-level WBS items
      if (wbsItem.isTopLevel) {
        return res.status(400).json({ message: "Cannot delete top-level WBS items" });
      }

      await storage.deleteWbsItem(id);
      res.status(204).end();
    } catch (err) {
      handleError(err, res);
    }
  });

  // Dependency routes
  app.get("/api/wbs/:wbsItemId/dependencies", async (req: Request, res: Response) => {
    try {
      const wbsItemId = parseInt(req.params.wbsItemId);
      if (isNaN(wbsItemId)) {
        return res.status(400).json({ message: "Invalid WBS item ID" });
      }

      const dependencies = await storage.getDependencies(wbsItemId);
      res.json(dependencies);
    } catch (err) {
      handleError(err, res);
    }
  });

  app.post("/api/dependencies", async (req: Request, res: Response) => {
    try {
      const dependencyData = insertDependencySchema.parse(req.body);
      
      // Check for circular dependencies
      if (dependencyData.predecessorId === dependencyData.successorId) {
        return res.status(400).json({ message: "Cannot create self-dependency" });
      }

      // Validate that both WBS items exist
      const predecessor = await storage.getWbsItem(dependencyData.predecessorId);
      if (!predecessor) {
        return res.status(404).json({ message: "Predecessor WBS item not found" });
      }

      const successor = await storage.getWbsItem(dependencyData.successorId);
      if (!successor) {
        return res.status(404).json({ message: "Successor WBS item not found" });
      }

      // Only Activity items should have dependencies
      if (predecessor.type !== "Activity" || successor.type !== "Activity") {
        return res.status(400).json({ 
          message: "Dependencies can only be created between 'Activity' items" 
        });
      }

      const dependency = await storage.createDependency(dependencyData);
      res.status(201).json(dependency);
    } catch (err) {
      handleError(err, res);
    }
  });

  app.delete("/api/dependencies/:predecessorId/:successorId", async (req: Request, res: Response) => {
    try {
      const predecessorId = parseInt(req.params.predecessorId);
      const successorId = parseInt(req.params.successorId);
      
      if (isNaN(predecessorId) || isNaN(successorId)) {
        return res.status(400).json({ message: "Invalid dependency IDs" });
      }

      await storage.deleteDependency(predecessorId, successorId);
      res.status(204).end();
    } catch (err) {
      handleError(err, res);
    }
  });

  // Cost entry routes
  app.get("/api/wbs/:wbsItemId/costs", async (req: Request, res: Response) => {
    try {
      const wbsItemId = parseInt(req.params.wbsItemId);
      if (isNaN(wbsItemId)) {
        return res.status(400).json({ message: "Invalid WBS item ID" });
      }

      const costEntries = await storage.getCostEntries(wbsItemId);
      res.json(costEntries);
    } catch (err) {
      handleError(err, res);
    }
  });

  app.post("/api/costs", async (req: Request, res: Response) => {
    try {
      const costEntryData = insertCostEntrySchema.parse(req.body);
      
      // Validate that the WBS item exists
      const wbsItem = await storage.getWbsItem(costEntryData.wbsItemId);
      if (!wbsItem) {
        return res.status(404).json({ message: "WBS item not found" });
      }

      // Only WorkPackage items can have cost entries
      if (wbsItem.type !== "WorkPackage" && wbsItem.type !== "Summary") {
        return res.status(400).json({ 
          message: "Cost entries can only be added to 'WorkPackage' or 'Summary' items" 
        });
      }

      const costEntry = await storage.createCostEntry(costEntryData);
      res.status(201).json(costEntry);
    } catch (err) {
      handleError(err, res);
    }
  });

  app.post("/api/costs/import", async (req: Request, res: Response) => {
    try {
      const { projectId, csvData } = req.body;
      
      if (!projectId || !csvData || !Array.isArray(csvData)) {
        return res.status(400).json({ message: "Invalid request body" });
      }

      // Validate the CSV data
      const validatedData = csvImportSchema.parse(csvData);
      
      // Get all WBS items for the project to map codes to IDs
      const wbsItems = await storage.getWbsItems(projectId);
      const wbsItemsByCode = new Map(wbsItems.map(item => [item.code, item]));
      
      // Transform validated data to cost entries
      const costEntries: Array<{
        wbsItemId: number;
        amount: string;
        description: string;
        entryDate: string;
      }> = [];
      const errors = [];

      for (let i = 0; i < validatedData.length; i++) {
        const row = validatedData[i];
        const wbsItem = wbsItemsByCode.get(row.wbsCode);
        
        if (!wbsItem) {
          errors.push(`Row ${i + 1}: WBS code '${row.wbsCode}' not found`);
          continue;
        }

        // Check if WBS item is of a type that can accept costs
        if (wbsItem.type !== "WorkPackage" && wbsItem.type !== "Summary") {
          errors.push(`Row ${i + 1}: WBS code '${row.wbsCode}' is of type '${wbsItem.type}', which cannot have cost entries`);
          continue;
        }

        costEntries.push({
          wbsItemId: wbsItem.id,
          amount: row.amount.toString(),
          description: row.description || "",
          entryDate: row.entryDate.toISOString()
        });
      }

      if (errors.length > 0) {
        return res.status(400).json({ 
          message: "Validation errors in CSV data", 
          errors 
        });
      }

      const createdEntries = await storage.createCostEntries(costEntries);
      res.status(201).json(createdEntries);
    } catch (err) {
      handleError(err, res);
    }
  });

  app.delete("/api/costs/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid cost entry ID" });
      }

      await storage.deleteCostEntry(id);
      res.status(204).end();
    } catch (err) {
      handleError(err, res);
    }
  });

  return httpServer;
}

// Helper function to check if there's a WorkPackage in the parent path of a WBS item
function checkForWorkPackageInPath(wbsItems: any[], item: any): boolean {
  if (!item.parentId) return false;
  
  const parent = wbsItems.find(wbs => wbs.id === item.parentId);
  if (!parent) return false;
  
  if (parent.type === "WorkPackage") return true;
  
  return checkForWorkPackageInPath(wbsItems, parent);
}
