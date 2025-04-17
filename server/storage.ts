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
} from "@shared/schema";
import { db } from "./db";
import { and, eq, or } from "drizzle-orm";

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
  createDependency(dependency: InsertDependency): Promise<Dependency>;
  deleteDependency(predecessorId: number, successorId: number): Promise<boolean>;

  // Cost entry methods
  getCostEntries(wbsItemId: number): Promise<CostEntry[]>;
  createCostEntry(costEntry: InsertCostEntry): Promise<CostEntry>;
  createCostEntries(costEntries: InsertCostEntry[]): Promise<CostEntry[]>;
  deleteCostEntry(id: number): Promise<boolean>;
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
    const [newProject] = await db.insert(projects).values(project).returning();
    return newProject;
  }

  async updateProject(id: number, project: Partial<InsertProject>): Promise<Project | undefined> {
    const [updatedProject] = await db
      .update(projects)
      .set(project)
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
    const [newWbsItem] = await db
      .insert(wbsItems)
      .values({
        ...wbsItem,
        actualCost: 0,
        percentComplete: 0,
      })
      .returning();
    return newWbsItem;
  }

  async updateWbsItem(id: number, wbsItem: Partial<InsertWbsItem>): Promise<WbsItem | undefined> {
    const [updatedWbsItem] = await db
      .update(wbsItems)
      .set(wbsItem)
      .where(eq(wbsItems.id, id))
      .returning();
    return updatedWbsItem;
  }

  async updateWbsProgress(id: number, progress: UpdateWbsProgress): Promise<WbsItem | undefined> {
    const [updatedWbsItem] = await db
      .update(wbsItems)
      .set({
        percentComplete: progress.percentComplete,
        actualStartDate: progress.actualStartDate,
        actualEndDate: progress.actualEndDate,
      })
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
      .values(costEntry)
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
          .values(entry)
          .returning();
        
        entries.push(newEntry);
        
        // Track amounts by WBS item ID
        const currentAmount = entriesByWbsItemId.get(entry.wbsItemId) || 0;
        entriesByWbsItemId.set(entry.wbsItemId, currentAmount + Number(entry.amount));
      }
      
      return entries;
    });
    
    // Update the actual costs for all affected WBS items
    for (const [wbsItemId, amount] of entriesByWbsItemId.entries()) {
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
        .set({ actualCost: newActualCost })
        .where(eq(wbsItems.id, wbsItemId));
    }
  }
}

export const storage = new DatabaseStorage();
