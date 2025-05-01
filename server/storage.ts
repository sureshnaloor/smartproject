import {
  Project,
  InsertProject,
  WbsItem,
  InsertWbsItem,
  Dependency,
  InsertDependency,
  CostEntry,
  InsertCostEntry,
  UpdateWbsProgress,
  projects,
  wbsItems,
  dependencies,
  costEntries,
  Task,
  InsertTask,
  tasks
} from "@shared/schema";
import { db } from "./db";
import { and, eq, or, inArray, sql } from "drizzle-orm";

// Storage interface
export interface IStorage {
  // Project methods
  getProjects(): Promise<Project[]>;
  getProject(id: number): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: number, project: Partial<InsertProject>): Promise<Project | undefined>;
  deleteProject(id: number): Promise<boolean>;

  // WBS methods
  getWbsItems(projectId: number): Promise<WbsItem[]>;
  getWbsItem(id: number): Promise<WbsItem | undefined>;
  createWbsItem(wbsItem: InsertWbsItem): Promise<WbsItem>;
  updateWbsItem(id: number, wbsItem: Partial<InsertWbsItem>): Promise<WbsItem | undefined>;
  updateWbsProgress(id: number, progress: UpdateWbsProgress): Promise<WbsItem | undefined>;
  deleteWbsItem(id: number): Promise<boolean>;

  // Dependency methods
  getDependencies(wbsItemId: number): Promise<Dependency[]>;
  getProjectDependencies(projectId: number): Promise<Dependency[]>;
  createDependency(dependency: InsertDependency): Promise<Dependency>;
  deleteDependency(predecessorId: number, successorId: number): Promise<boolean>;

  // Cost entry methods
  getCostEntries(wbsItemId: number): Promise<CostEntry[]>;
  createCostEntry(costEntry: InsertCostEntry): Promise<CostEntry>;
  createCostEntries(costEntries: InsertCostEntry[]): Promise<CostEntry[]>;
  deleteCostEntry(id: number): Promise<boolean>;
  
  // Task methods
  getTasks(projectId: number): Promise<Task[]>;
  getTasksByActivity(activityId: number): Promise<Task[]>;
  getTask(id: number): Promise<Task | undefined>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: number, task: Partial<InsertTask>): Promise<Task | undefined>;
  deleteTask(id: number): Promise<boolean>;
  createTasks(tasksList: InsertTask[]): Promise<Task[]>;
}

// Database storage implementation using Drizzle ORM
export class DatabaseStorage implements IStorage {
  // Project methods
  async getProjects(): Promise<Project[]> {
    return await db.select().from(projects);
  }

  async getProject(id: number): Promise<Project | undefined> {
    const result = await db.select().from(projects).where(eq(projects.id, id));
    return result[0];
  }
  async createProject(project: InsertProject): Promise<Project> {
    const [newProject] = await db.insert(projects).values({
      ...project,
      budget: project.budget.toString() // Convert number to string for DB
    }).returning();
    return newProject;
  }

  async updateProject(id: number, project: Partial<InsertProject>): Promise<Project | undefined> {
    // Make sure budget is converted to string if it exists
    const updatedValues = { ...project };
    if (updatedValues.budget !== undefined) {
      updatedValues.budget = updatedValues.budget.toString();
    }

    const [updatedProject] = await db
      .update(projects)
      .set(updatedValues)
      .where(eq(projects.id, id))
      .returning();
    return updatedProject;
  }

  async deleteProject(id: number): Promise<boolean> {
    // The foreign key constraints in the database will cascade delete related items
    const result = await db.delete(projects).where(eq(projects.id, id)).returning();
    return result.length > 0;
  }

  // WBS methods
  async getWbsItems(projectId: number): Promise<WbsItem[]> {
    return await db.select().from(wbsItems).where(eq(wbsItems.projectId, projectId));
  }

  async getWbsItem(id: number): Promise<WbsItem | undefined> {
    const result = await db.select().from(wbsItems).where(eq(wbsItems.id, id));
    return result[0];
  }

  async createWbsItem(wbsItem: InsertWbsItem): Promise<WbsItem> {
    // Make sure budgeted cost is converted to string
    const insertValues = {
      ...wbsItem,
      budgetedCost: wbsItem.budgetedCost.toString(),
    };

    const [newWbsItem] = await db
      .insert(wbsItems)
      .values({
        ...insertValues,
        actualCost: "0", // Use string for numeric fields
        percentComplete: "0",
      })
      .returning();
    return newWbsItem;
  }

  async updateWbsItem(id: number, wbsItem: Partial<InsertWbsItem>): Promise<WbsItem | undefined> {
    // Convert budgetedCost to string if it exists
    const updatedValues = { ...wbsItem };
    if (updatedValues.budgetedCost !== undefined) {
      updatedValues.budgetedCost = updatedValues.budgetedCost.toString();
    }

    // Convert dates to ISO strings if they exist
    if (updatedValues.startDate) {
      updatedValues.startDate = updatedValues.startDate.toISOString();
    }
    if (updatedValues.endDate) {
      updatedValues.endDate = updatedValues.endDate.toISOString();
    }

    const [updatedWbsItem] = await db
      .update(wbsItems)
      .set(updatedValues)
      .where(eq(wbsItems.id, id))
      .returning();
    return updatedWbsItem;
  }

  async updateWbsProgress(id: number, progress: UpdateWbsProgress): Promise<WbsItem | undefined> {
    // Convert values to appropriate types for database
    const updateValues = {
      percentComplete: progress.percentComplete.toString(),
      actualStartDate: progress.actualStartDate ? progress.actualStartDate.toISOString() : null,
      actualEndDate: progress.actualEndDate ? progress.actualEndDate.toISOString() : null,
    };

    const [updatedWbsItem] = await db
      .update(wbsItems)
      .set(updateValues)
      .where(eq(wbsItems.id, id))
      .returning();
    return updatedWbsItem;
  }

  async deleteWbsItem(id: number): Promise<boolean> {
    // The foreign key constraints in the database will cascade delete related dependencies and cost entries
    const result = await db.delete(wbsItems).where(eq(wbsItems.id, id)).returning();
    return result.length > 0;
  }

  // Dependency methods
  async getDependencies(wbsItemId: number): Promise<Dependency[]> {
    return await db
      .select()
      .from(dependencies)
      .where(
        or(
          eq(dependencies.predecessorId, wbsItemId),
          eq(dependencies.successorId, wbsItemId)
        )
      );
  }

  async getProjectDependencies(projectId: number): Promise<Dependency[]> {
    // First get all WBS items for this project
    const wbsItems = await this.getWbsItems(projectId);
    if (!wbsItems.length) return [];
    
    // Extract all WBS item IDs
    const wbsItemIds = wbsItems.map(item => item.id);
    
    // Find all dependencies where either predecessor or successor belongs to this project
    const result = await db
      .select()
      .from(dependencies)
      .where(
        or(
          inArray(dependencies.predecessorId, wbsItemIds),
          inArray(dependencies.successorId, wbsItemIds)
        )
      );
      
    return result;
  }

  async createDependency(dependency: InsertDependency): Promise<Dependency> {
    const [newDependency] = await db
      .insert(dependencies)
      .values(dependency)
      .returning();
    return newDependency;
  }

  async deleteDependency(predecessorId: number, successorId: number): Promise<boolean> {
    const result = await db
      .delete(dependencies)
      .where(
        and(
          eq(dependencies.predecessorId, predecessorId),
          eq(dependencies.successorId, successorId)
        )
      )
      .returning();
    return result.length > 0;
  }

  // Cost entry methods
  async getCostEntries(wbsItemId: number): Promise<CostEntry[]> {
    return await db
      .select()
      .from(costEntries)
      .where(eq(costEntries.wbsItemId, wbsItemId));
  }

  async createCostEntry(costEntry: InsertCostEntry): Promise<CostEntry> {
    const [newCostEntry] = await db
      .insert(costEntries)
      .values({
        ...costEntry,
        amount: costEntry.amount.toString(),
        entryDate: new Date(costEntry.entryDate).toISOString()
      })
      .returning();
    
    // Update the actual cost of the WBS item
    await this.updateWbsItemCost(costEntry.wbsItemId, Number(costEntry.amount));
    
    return newCostEntry;
  }

  async createCostEntries(costEntries: InsertCostEntry[]): Promise<CostEntry[]> {
    if (costEntries.length === 0) return [];
    
    // Group cost entries by WBS item ID to update actual costs properly
    const entriesByWbsItemId = new Map<number, number>();
    
    // Insert all cost entries in a single transaction
    const insertedEntries = await db.transaction(async (tx) => {
      const entries: CostEntry[] = [];
      
      for (const entry of costEntries) {
        const [newEntry] = await tx
          .insert(costEntries)
          .values({
            ...entry,
            amount: entry.amount.toString(),
            entryDate: new Date(entry.entryDate).toISOString()
          })
          .returning();
        
        entries.push(newEntry as CostEntry); // Type assertion
        
        // Track amounts by WBS item ID
        const currentAmount = entriesByWbsItemId.get(entry.wbsItemId) || 0;
        entriesByWbsItemId.set(entry.wbsItemId, currentAmount + Number(entry.amount));
      }
      
      return entries;
    });
    
    // Update the actual costs for all affected WBS items
    for (const wbsItemId of entriesByWbsItemId.keys()) {
      const amount = entriesByWbsItemId.get(wbsItemId) || 0;
      await this.updateWbsItemCost(wbsItemId, amount);
    }
    
    return insertedEntries;
  }

  async deleteCostEntry(id: number): Promise<boolean> {
    // First get the cost entry to know the amount and WBS item ID
    const [costEntry] = await db
      .select()
      .from(costEntries)
      .where(eq(costEntries.id, id));
    
    if (!costEntry) return false;
    
    // Delete the cost entry
    const result = await db
      .delete(costEntries)
      .where(eq(costEntries.id, id))
      .returning();
    
    // Update the actual cost of the WBS item (subtract the amount)
    if (result.length > 0) {
      await this.updateWbsItemCost(costEntry.wbsItemId, -Number(costEntry.amount));
      return true;
    }
    
    return false;
  }

  // Helper method to update WBS item actual cost
  private async updateWbsItemCost(wbsItemId: number, amountChange: number): Promise<void> {
    const [wbsItem] = await db
      .select()
      .from(wbsItems)
      .where(eq(wbsItems.id, wbsItemId));
    
    if (wbsItem) {
      const newActualCost = Number(wbsItem.actualCost) + amountChange;
      
      await db
        .update(wbsItems)
        .set({ actualCost: newActualCost.toString() }) // Convert number to string
        .where(eq(wbsItems.id, wbsItemId));
    }
  }

  // Task methods
  async getTasks(projectId: number): Promise<Task[]> {
    return await db.select().from(tasks).where(eq(tasks.projectId, projectId));
  }

  async getTasksByActivity(activityId: number): Promise<Task[]> {
    return await db.select().from(tasks).where(eq(tasks.activityId, activityId));
  }

  async getTask(id: number): Promise<Task | undefined> {
    const result = await db.select().from(tasks).where(eq(tasks.id, id));
    return result[0];
  }

  async createTask(task: InsertTask): Promise<Task> {
    // Validate that the referenced activity exists and is an activity type
    const activity = await this.getWbsItem(task.activityId);
    if (!activity) {
      throw new Error("Activity not found");
    }
    
    if (activity.type !== "Activity") {
      throw new Error("Tasks can only be assigned to activities");
    }
    
    // Calculate endDate if not provided but duration is
    let taskToInsert = { ...task };
    if (!taskToInsert.endDate && taskToInsert.startDate && taskToInsert.duration) {
      const startDate = new Date(taskToInsert.startDate);
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + Number(taskToInsert.duration));
      taskToInsert.endDate = endDate;
    }
    
    // Calculate duration if not provided but endDate is
    if (!taskToInsert.duration && taskToInsert.startDate && taskToInsert.endDate) {
      const startDate = new Date(taskToInsert.startDate);
      const endDate = new Date(taskToInsert.endDate);
      const durationDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      taskToInsert.duration = durationDays;
    }

    // Convert data for DB
    const dbTask = {
      name: taskToInsert.name,
      description: taskToInsert.description,
      activityId: taskToInsert.activityId,
      projectId: taskToInsert.projectId,
      percentComplete: taskToInsert.percentComplete?.toString() || "0",
      startDate: taskToInsert.startDate ? new Date(taskToInsert.startDate).toISOString() : null,
      endDate: taskToInsert.endDate ? new Date(taskToInsert.endDate).toISOString() : null,
      duration: taskToInsert.duration ? taskToInsert.duration.toString() : null
    };
    
    const [newTask] = await db
      .insert(tasks)
      .values(dbTask)
      .returning();
    
    return newTask;
  }

  async updateTask(id: number, taskUpdate: Partial<InsertTask>): Promise<Task | undefined> {
    // Get the current task
    const currentTask = await this.getTask(id);
    if (!currentTask) {
      throw new Error("Task not found");
    }
    
    // If activity ID is being changed, validate the new activity
    if (taskUpdate.activityId && taskUpdate.activityId !== currentTask.activityId) {
      const newActivity = await this.getWbsItem(taskUpdate.activityId);
      if (!newActivity) {
        throw new Error("Activity not found");
      }
      
      if (newActivity.type !== "Activity") {
        throw new Error("Tasks can only be assigned to activities");
      }
    }
    
    // Handle date and duration calculations
    let taskToUpdate = { ...taskUpdate };
    
    // If start date is changing but duration remains, recalculate end date
    if (
      taskToUpdate.startDate && 
      !taskToUpdate.endDate && 
      !taskToUpdate.duration && 
      currentTask.duration
    ) {
      const startDate = new Date(taskToUpdate.startDate);
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + Number(currentTask.duration));
      taskToUpdate.endDate = endDate;
    }
    
    // If end date is changing but duration remains, recalculate duration
    if (
      taskToUpdate.endDate && 
      !taskToUpdate.duration && 
      currentTask.startDate
    ) {
      const startDate = new Date(taskToUpdate.startDate || currentTask.startDate);
      const endDate = new Date(taskToUpdate.endDate);
      const durationDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      taskToUpdate.duration = durationDays;
    }
    
    // If duration is changing but start date remains, recalculate end date
    if (
      taskToUpdate.duration && 
      !taskToUpdate.endDate && 
      currentTask.startDate
    ) {
      const startDate = new Date(taskToUpdate.startDate || currentTask.startDate);
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + Number(taskToUpdate.duration));
      taskToUpdate.endDate = endDate;
    }
    
    // Convert values for database
    const dbTaskUpdate: any = {};
    
    if (taskToUpdate.name !== undefined) dbTaskUpdate.name = taskToUpdate.name;
    if (taskToUpdate.description !== undefined) dbTaskUpdate.description = taskToUpdate.description;
    if (taskToUpdate.activityId !== undefined) dbTaskUpdate.activityId = taskToUpdate.activityId;
    if (taskToUpdate.projectId !== undefined) dbTaskUpdate.projectId = taskToUpdate.projectId;
    if (taskToUpdate.percentComplete !== undefined) dbTaskUpdate.percentComplete = taskToUpdate.percentComplete.toString();
    if (taskToUpdate.startDate !== undefined) dbTaskUpdate.startDate = new Date(taskToUpdate.startDate).toISOString();
    if (taskToUpdate.endDate !== undefined) dbTaskUpdate.endDate = new Date(taskToUpdate.endDate).toISOString();
    if (taskToUpdate.duration !== undefined) dbTaskUpdate.duration = taskToUpdate.duration.toString();
    
    const [updatedTask] = await db
      .update(tasks)
      .set(dbTaskUpdate)
      .where(eq(tasks.id, id))
      .returning();
    
    return updatedTask;
  }

  async deleteTask(id: number): Promise<boolean> {
    const result = await db
      .delete(tasks)
      .where(eq(tasks.id, id))
      .returning();
    
    return result.length > 0;
  }

  async createTasks(tasksList: InsertTask[]): Promise<Task[]> {
    if (tasksList.length === 0) {
      return [];
    }
    
    // Validate that all activities exist and are activity type
    const activityIds = Array.from(new Set(tasksList.map(t => t.activityId)));
    const activities = await Promise.all(
      activityIds.map(id => this.getWbsItem(id))
    );
    
    // Check if all activities exist
    if (activities.some(a => !a)) {
      throw new Error("One or more activities not found");
    }
    
    // Check if all are activity type
    if (activities.some(a => a!.type !== "Activity")) {
      throw new Error("Tasks can only be assigned to activities");
    }
    
    // Process each task to ensure dates and durations are properly set
    const processedTasks = tasksList.map(task => {
      let processedTask = { ...task };
      
      // Calculate endDate if not provided but duration is
      if (!processedTask.endDate && processedTask.startDate && processedTask.duration) {
        const startDate = new Date(processedTask.startDate);
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + Number(processedTask.duration));
        processedTask.endDate = endDate;
      }
      
      // Calculate duration if not provided but endDate is
      if (!processedTask.duration && processedTask.startDate && processedTask.endDate) {
        const startDate = new Date(processedTask.startDate);
        const endDate = new Date(processedTask.endDate);
        const durationDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        processedTask.duration = durationDays;
      }
      
      // Convert data for DB
      return {
        name: processedTask.name,
        description: processedTask.description,
        activityId: processedTask.activityId,
        projectId: processedTask.projectId,
        percentComplete: processedTask.percentComplete?.toString() || "0",
        startDate: processedTask.startDate ? new Date(processedTask.startDate).toISOString() : null,
        endDate: processedTask.endDate ? new Date(processedTask.endDate).toISOString() : null,
        duration: processedTask.duration ? processedTask.duration.toString() : null
      };
    });
    
    const newTasks = await db
      .insert(tasks)
      .values(processedTasks)
      .returning();
    
    return newTasks;
  }
}

export const storage = new DatabaseStorage();
