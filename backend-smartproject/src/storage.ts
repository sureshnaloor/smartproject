import type {
  Project,
  WbsItem,
  Dependency,
  CostEntry,
  Task
} from "./schema";
import { db } from "./db";
import { and, eq, or, inArray, sql } from "drizzle-orm";
import { projects, wbsItems, dependencies, costEntries, tasks } from "./schema";

// Storage interface
export interface IStorage {
  // Project methods
  getProjects(): Promise<Project[]>;
  getProject(id: number): Promise<Project | undefined>;
  createProject(project: Omit<Project, "id" | "createdAt">): Promise<Project>;
  updateProject(id: number, project: Partial<Omit<Project, "id" | "createdAt">>): Promise<Project | undefined>;
  deleteProject(id: number): Promise<void>;

  // WBS methods
  getWbsItems(projectId: number): Promise<WbsItem[]>;
  getWbsItem(id: number): Promise<WbsItem | undefined>;
  createWbsItem(wbsItem: Omit<WbsItem, "id" | "createdAt">): Promise<WbsItem>;
  updateWbsItem(id: number, wbsItem: Partial<Omit<WbsItem, "id" | "createdAt">>): Promise<WbsItem | undefined>;
  deleteWbsItem(id: number): Promise<void>;

  // Dependency methods
  getDependencies(projectId: number): Promise<Dependency[]>;
  getDependency(id: number): Promise<Dependency | undefined>;
  createDependency(dependency: Omit<Dependency, "id" | "createdAt">): Promise<Dependency>;
  updateDependency(id: number, dependency: Partial<Omit<Dependency, "id" | "createdAt">>): Promise<Dependency | undefined>;
  deleteDependency(id: number): Promise<void>;

  // Cost entry methods
  getCostEntries(wbsItemId: number): Promise<CostEntry[]>;
  getCostEntry(id: number): Promise<CostEntry | undefined>;
  createCostEntry(costEntry: Omit<CostEntry, "id" | "createdAt">): Promise<CostEntry>;
  updateCostEntry(id: number, costEntry: Partial<Omit<CostEntry, "id" | "createdAt">>): Promise<CostEntry | undefined>;
  deleteCostEntry(id: number): Promise<void>;
  
  // Task methods
  getTasks(id: number): Promise<Task[]>;
  getTask(id: number): Promise<Task | undefined>;
  createTask(task: Omit<Task, "id" | "createdAt">): Promise<Task>;
  updateTask(id: number, task: Partial<Omit<Task, "id" | "createdAt">>): Promise<Task | undefined>;
  deleteTask(id: number): Promise<void>;
}

// Database storage implementation using Drizzle ORM
export class DatabaseStorage implements IStorage {
  // Project methods
  async getProjects(): Promise<Project[]> {
    const dbProjects = await db.select().from(projects);
    return dbProjects.map(p => ({
      ...p,
      budget: Number(p.budget),
      startDate: new Date(p.startDate),
      endDate: new Date(p.endDate),
      currency: p.currency as "USD" | "EUR" | "SAR"
    }));
  }

  async getProject(id: number): Promise<Project | undefined> {
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, id));

    if (!project) return undefined;

    return {
      ...project,
      budget: Number(project.budget),
      startDate: new Date(project.startDate),
      endDate: new Date(project.endDate),
      currency: project.currency as "USD" | "EUR" | "SAR"
    };
  }

  async createProject(project: Omit<Project, "id" | "createdAt">): Promise<Project> {
    const [newProject] = await db.insert(projects).values({
      ...project,
      budget: project.budget.toString(),
      startDate: project.startDate.toISOString(),
      endDate: project.endDate.toISOString()
    }).returning();

    return {
      ...newProject,
      budget: Number(newProject.budget),
      startDate: new Date(newProject.startDate),
      endDate: new Date(newProject.endDate),
      currency: newProject.currency as "USD" | "EUR" | "SAR"
    };
  }

  async updateProject(id: number, project: Partial<Omit<Project, "id" | "createdAt">>): Promise<Project | undefined> {
    const updatedValues: any = { ...project };
    
    if (updatedValues.budget !== undefined) {
      updatedValues.budget = updatedValues.budget.toString();
    }
    if (updatedValues.startDate) {
      updatedValues.startDate = updatedValues.startDate.toISOString();
    }
    if (updatedValues.endDate) {
      updatedValues.endDate = updatedValues.endDate.toISOString();
    }

    const [updatedProject] = await db
      .update(projects)
      .set(updatedValues)
      .where(eq(projects.id, id))
      .returning();

    if (!updatedProject) return undefined;

    return {
      ...updatedProject,
      budget: Number(updatedProject.budget),
      startDate: new Date(updatedProject.startDate),
      endDate: new Date(updatedProject.endDate),
      currency: updatedProject.currency as "USD" | "EUR" | "SAR"
    };
  }

  async deleteProject(id: number): Promise<void> {
    await db.delete(projects).where(eq(projects.id, id));
  }

  // WBS methods
  async getWbsItems(projectId: number): Promise<WbsItem[]> {
    const dbItems = await db
      .select()
      .from(wbsItems)
      .where(eq(wbsItems.projectId, projectId));

    return dbItems.map(item => ({
      ...item,
      budgetedCost: Number(item.budgetedCost),
      actualCost: Number(item.actualCost),
      percentComplete: Number(item.percentComplete),
      startDate: item.startDate ? new Date(item.startDate) : undefined,
      endDate: item.endDate ? new Date(item.endDate) : undefined,
      actualStartDate: item.actualStartDate ? new Date(item.actualStartDate) : undefined,
      actualEndDate: item.actualEndDate ? new Date(item.actualEndDate) : undefined,
      type: item.type as "Summary" | "WorkPackage" | "Activity"
    }));
  }

  async getWbsItem(id: number): Promise<WbsItem | undefined> {
    const [item] = await db
      .select()
      .from(wbsItems)
      .where(eq(wbsItems.id, id));

    if (!item) return undefined;

    return {
      ...item,
      budgetedCost: Number(item.budgetedCost),
      actualCost: Number(item.actualCost),
      percentComplete: Number(item.percentComplete),
      startDate: item.startDate ? new Date(item.startDate) : undefined,
      endDate: item.endDate ? new Date(item.endDate) : undefined,
      actualStartDate: item.actualStartDate ? new Date(item.actualStartDate) : undefined,
      actualEndDate: item.actualEndDate ? new Date(item.actualEndDate) : undefined,
      type: item.type as "Summary" | "WorkPackage" | "Activity"
    };
  }

  async createWbsItem(wbsItem: Omit<WbsItem, "id" | "createdAt">): Promise<WbsItem> {
    const insertValues = {
      ...wbsItem,
      budgetedCost: wbsItem.budgetedCost.toString(),
      actualCost: "0",
      percentComplete: "0",
      startDate: wbsItem.startDate?.toISOString(),
      endDate: wbsItem.endDate?.toISOString(),
      actualStartDate: wbsItem.actualStartDate?.toISOString(),
      actualEndDate: wbsItem.actualEndDate?.toISOString()
    };

    const [newWbsItem] = await db
      .insert(wbsItems)
      .values(insertValues)
      .returning();

    return {
      ...newWbsItem,
      budgetedCost: Number(newWbsItem.budgetedCost),
      actualCost: Number(newWbsItem.actualCost),
      percentComplete: Number(newWbsItem.percentComplete),
      startDate: newWbsItem.startDate ? new Date(newWbsItem.startDate) : undefined,
      endDate: newWbsItem.endDate ? new Date(newWbsItem.endDate) : undefined,
      actualStartDate: newWbsItem.actualStartDate ? new Date(newWbsItem.actualStartDate) : undefined,
      actualEndDate: newWbsItem.actualEndDate ? new Date(newWbsItem.actualEndDate) : undefined,
      type: newWbsItem.type as "Summary" | "WorkPackage" | "Activity"
    };
  }

  async updateWbsItem(id: number, wbsItem: Partial<Omit<WbsItem, "id" | "createdAt">>): Promise<WbsItem | undefined> {
    const updatedValues: any = { ...wbsItem };
    
    if (updatedValues.budgetedCost !== undefined) {
      updatedValues.budgetedCost = updatedValues.budgetedCost.toString();
    }
    if (updatedValues.actualCost !== undefined) {
      updatedValues.actualCost = updatedValues.actualCost.toString();
    }
    if (updatedValues.percentComplete !== undefined) {
      updatedValues.percentComplete = updatedValues.percentComplete.toString();
    }
    if (updatedValues.startDate) {
      updatedValues.startDate = updatedValues.startDate.toISOString();
    }
    if (updatedValues.endDate) {
      updatedValues.endDate = updatedValues.endDate.toISOString();
    }
    if (updatedValues.actualStartDate) {
      updatedValues.actualStartDate = updatedValues.actualStartDate.toISOString();
    }
    if (updatedValues.actualEndDate) {
      updatedValues.actualEndDate = updatedValues.actualEndDate.toISOString();
    }

    const [updatedWbsItem] = await db
      .update(wbsItems)
      .set(updatedValues)
      .where(eq(wbsItems.id, id))
      .returning();

    if (!updatedWbsItem) return undefined;

    return {
      ...updatedWbsItem,
      budgetedCost: Number(updatedWbsItem.budgetedCost),
      actualCost: Number(updatedWbsItem.actualCost),
      percentComplete: Number(updatedWbsItem.percentComplete),
      startDate: updatedWbsItem.startDate ? new Date(updatedWbsItem.startDate) : undefined,
      endDate: updatedWbsItem.endDate ? new Date(updatedWbsItem.endDate) : undefined,
      actualStartDate: updatedWbsItem.actualStartDate ? new Date(updatedWbsItem.actualStartDate) : undefined,
      actualEndDate: updatedWbsItem.actualEndDate ? new Date(updatedWbsItem.actualEndDate) : undefined,
      type: updatedWbsItem.type as "Summary" | "WorkPackage" | "Activity"
    };
  }

  async deleteWbsItem(id: number): Promise<void> {
    await db.delete(wbsItems).where(eq(wbsItems.id, id));
  }

  // Dependency methods
  async getDependencies(projectId: number): Promise<Dependency[]> {
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

  async getDependency(id: number): Promise<Dependency | undefined> {
    const result = await db.select().from(dependencies).where(eq(dependencies.id, id));
    return result[0];
  }

  async createDependency(dependency: Omit<Dependency, "id" | "createdAt">): Promise<Dependency> {
    const [newDependency] = await db
      .insert(dependencies)
      .values(dependency)
      .returning();
    return newDependency;
  }

  async updateDependency(id: number, dependency: Partial<Omit<Dependency, "id" | "createdAt">>): Promise<Dependency | undefined> {
    const updatedValues: any = { ...dependency };
    
    if (updatedValues.predecessorId) {
      updatedValues.predecessorId = updatedValues.predecessorId.toString();
    }
    if (updatedValues.successorId) {
      updatedValues.successorId = updatedValues.successorId.toString();
    }

    const [updatedDependency] = await db
      .update(dependencies)
      .set(updatedValues)
      .where(eq(dependencies.id, id))
      .returning();

    if (!updatedDependency) return undefined;

    return {
      ...updatedDependency,
      predecessorId: updatedDependency.predecessorId ? Number(updatedDependency.predecessorId) : undefined,
      successorId: updatedDependency.successorId ? Number(updatedDependency.successorId) : undefined
    };
  }

  async deleteDependency(id: number): Promise<void> {
    await db.delete(dependencies).where(eq(dependencies.id, id));
  }

  // Cost entry methods
  async getCostEntries(wbsItemId: number): Promise<CostEntry[]> {
    return await db
      .select()
      .from(costEntries)
      .where(eq(costEntries.wbsItemId, wbsItemId));
  }

  async getCostEntry(id: number): Promise<CostEntry | undefined> {
    const result = await db.select().from(costEntries).where(eq(costEntries.id, id));
    return result[0];
  }

  async createCostEntry(costEntry: Omit<CostEntry, "id" | "createdAt">): Promise<CostEntry> {
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
    
    return {
      ...newCostEntry,
      amount: Number(newCostEntry.amount),
      entryDate: new Date(newCostEntry.entryDate)
    };
  }

  async updateCostEntry(id: number, costEntry: Partial<Omit<CostEntry, "id" | "createdAt">>): Promise<CostEntry | undefined> {
    const updatedValues: any = { ...costEntry };
    
    if (updatedValues.amount !== undefined) {
      updatedValues.amount = updatedValues.amount.toString();
    }
    if (updatedValues.entryDate) {
      updatedValues.entryDate = updatedValues.entryDate.toISOString();
    }

    const [updatedCostEntry] = await db
      .update(costEntries)
      .set(updatedValues)
      .where(eq(costEntries.id, id))
      .returning();

    if (!updatedCostEntry) return undefined;

    return {
      ...updatedCostEntry,
      amount: updatedCostEntry.amount ? Number(updatedCostEntry.amount) : undefined,
      entryDate: updatedCostEntry.entryDate ? new Date(updatedCostEntry.entryDate) : undefined
    };
  }

  async deleteCostEntry(id: number): Promise<void> {
    // First get the cost entry to know the amount and WBS item ID
    const [costEntry] = await db
      .select()
      .from(costEntries)
      .where(eq(costEntries.id, id));
    
    if (!costEntry) return;
    
    // Delete the cost entry
    await db
      .delete(costEntries)
      .where(eq(costEntries.id, id));
    
    // Update the actual cost of the WBS item (subtract the amount)
    await this.updateWbsItemCost(costEntry.wbsItemId, -Number(costEntry.amount));
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
  async getTasks(id: number): Promise<Task[]> {
    // If the ID is a project ID, get all tasks for that project
    const project = await this.getProject(id);
    if (project) {
      return await db.select().from(tasks).where(eq(tasks.projectId, id));
    }
    
    // Otherwise, treat it as an activity ID and get tasks for that activity
    return await db.select().from(tasks).where(eq(tasks.activityId, id));
  }

  async getTask(id: number): Promise<Task | undefined> {
    const result = await db.select().from(tasks).where(eq(tasks.id, id));
    return result[0];
  }

  async createTask(task: Omit<Task, "id" | "createdAt">): Promise<Task> {
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

  async updateTask(id: number, taskUpdate: Partial<Omit<Task, "id" | "createdAt">>): Promise<Task | undefined> {
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

  async deleteTask(id: number): Promise<void> {
    await db
      .delete(tasks)
      .where(eq(tasks.id, id));
  }
}

export const storage = new DatabaseStorage();
