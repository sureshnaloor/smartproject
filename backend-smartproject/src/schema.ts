import { pgTable, text, serial, integer, numeric, date, timestamp, boolean, primaryKey, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Projects Table
export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  budget: numeric("budget", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").default("USD").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// WBS Table - Updated with revised structure
export const wbsItems = pgTable("wbs_items", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  parentId: integer("parent_id"),
  name: text("name").notNull(),
  description: text("description"),
  level: integer("level").notNull(), // 1, 2, 3, etc.
  code: text("code").notNull(), // e.g. 1, 1.1, 1.1.1
  type: text("type").notNull(), // Summary, WorkPackage, Activity (removed Task)
  budgetedCost: numeric("budgeted_cost", { precision: 12, scale: 2 }).notNull(),
  actualCost: numeric("actual_cost", { precision: 12, scale: 2 }).default("0"),
  percentComplete: numeric("percent_complete", { precision: 5, scale: 2 }).default("0"),
  startDate: date("start_date"),  // Now optional - only for Activities
  endDate: date("end_date"),      // Now optional - only for Activities
  duration: integer("duration"),  // Now optional - only for Activities
  actualStartDate: date("actual_start_date"),
  actualEndDate: date("actual_end_date"),
  isTopLevel: boolean("is_top_level").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Dependencies Table
export const dependencies = pgTable("dependencies", {
  id: serial("id").primaryKey(),
  predecessorId: integer("predecessor_id").notNull().references(() => wbsItems.id, { onDelete: "cascade" }),
  successorId: integer("successor_id").notNull().references(() => wbsItems.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // FS (Finish-to-Start), SS (Start-to-Start), etc.
  lag: integer("lag").default(0), // in days
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Cost Entries Table
export const costEntries = pgTable("cost_entries", {
  id: serial("id").primaryKey(),
  wbsItemId: integer("wbs_item_id").notNull().references(() => wbsItems.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  description: text("description"),
  entryDate: date("entry_date").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Tasks Table
export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  activityId: integer("activity_id").notNull().references(() => wbsItems.id, { onDelete: "cascade" }),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  duration: integer("duration"),
  percentComplete: numeric("percent_complete", { precision: 5, scale: 2 }).default("0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Insert Schemas
export const insertProjectSchema = createInsertSchema(projects)
  .omit({ id: true, createdAt: true })
  .extend({
    budget: z.string().or(z.number()).pipe(
      z.coerce.number().positive("Budget must be a positive number")
    ),
    currency: z.enum(["USD", "EUR", "SAR"]).default("USD"),
    startDate: z.date().or(z.string().transform(str => new Date(str))),
    endDate: z.date().or(z.string().transform(str => new Date(str))),
  });

// Base WBS schema - a simpler version without all the refinements
const baseWbsSchema = createInsertSchema(wbsItems)
  .omit({ id: true, createdAt: true, actualCost: true, percentComplete: true, actualStartDate: true, actualEndDate: true })
  .extend({
    budgetedCost: z.string().or(z.number()).pipe(
      z.coerce.number().nonnegative("Budgeted cost must be a non-negative number")
    ),
    type: z.enum(["Summary", "WorkPackage", "Activity"]),
    startDate: z.date().or(z.string()).pipe(z.coerce.date()).optional(),
    endDate: z.date().or(z.string()).pipe(z.coerce.date()).optional(),
    duration: z.string().or(z.number()).pipe(z.coerce.number().nonnegative()).optional(),
  });

// Updated WBS schema with conditional validations
export const insertWbsItemSchema = baseWbsSchema
  .refine(
    (data) => {
      // Summary and WorkPackage types must have budgetedCost
      if (data.type === "Summary" || data.type === "WorkPackage") {
        return data.budgetedCost !== undefined && data.budgetedCost >= 0;
      }
      return true;
    },
    {
      message: "Summary and WorkPackage types must have a budget",
      path: ["budgetedCost"],
    }
  )
  .refine(
    (data) => {
      // Activity types should not have budgetedCost (or set to 0)
      if (data.type === "Activity") {
        return data.budgetedCost === 0;
      }
      return true;
    },
    {
      message: "Activity types cannot have a budget",
      path: ["budgetedCost"],
    }
  )
  .refine(
    (data) => {
      // Activity types must have startDate, endDate and duration
      if (data.type === "Activity") {
        return (
          data.startDate !== undefined && 
          data.endDate !== undefined && 
          data.duration !== undefined && 
          data.duration > 0
        );
      }
      return true;
    },
    {
      message: "Activity types must have start date, end date, and duration",
      path: ["startDate"],
    }
  )
  .refine(
    (data) => {
      // Summary and WorkPackage should not have dates
      if (data.type === "Summary" || data.type === "WorkPackage") {
        return data.startDate === undefined && data.endDate === undefined;
      }
      return true;
    },
    {
      message: "Summary and WorkPackage types cannot have dates",
      path: ["startDate"],
    }
  );

export const insertDependencySchema = createInsertSchema(dependencies).omit({ id: true, createdAt: true });
export const insertCostEntrySchema = createInsertSchema(costEntries).omit({ id: true, createdAt: true });

// Task schema
export const insertTaskSchema = createInsertSchema(tasks)
  .omit({ id: true, createdAt: true })
  .extend({
    percentComplete: z.string().or(z.number()).pipe(
      z.coerce.number().min(0).max(100, "Percentage must be between 0 and 100")
    ).default(0),
    startDate: z.date().or(z.string().transform(str => str ? new Date(str) : undefined)).optional(),
    endDate: z.date().or(z.string().transform(str => str ? new Date(str) : undefined)).optional(),
    duration: z.string().or(z.number()).pipe(z.coerce.number().nonnegative()).optional(),
  })
  .refine(
    (data) => {
      // If startDate is provided, either endDate XOR duration should be provided (not both)
      if (data.startDate) {
        // XOR - either endDate exists or duration exists, but not both
        return (data.endDate !== undefined && data.duration === undefined) || 
               (data.endDate === undefined && data.duration !== undefined);
      }
      
      // If no startDate, no validation needed
      return true;
    },
    {
      message: "When start date is provided, you must provide either end date OR duration, but not both",
      path: ["endDate"],
    }
  );

// Types
export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;

export type WbsItem = typeof wbsItems.$inferSelect;
export type InsertWbsItem = z.infer<typeof insertWbsItemSchema>;

export type Dependency = typeof dependencies.$inferSelect;
export type InsertDependency = z.infer<typeof insertDependencySchema>;

export type CostEntry = typeof costEntries.$inferSelect;
export type InsertCostEntry = z.infer<typeof insertCostEntrySchema>;

export type Task = typeof tasks.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;

// Extended schemas for client-side validation
export const extendedInsertProjectSchema = insertProjectSchema.extend({
  name: z.string().min(3, "Project name must be at least 3 characters"),
  budget: z.string().or(z.number()).pipe(
    z.coerce.number().positive("Budget must be a positive number")
  ),
  startDate: z.date(),
  endDate: z.date(),
  currency: z.enum(["USD", "EUR", "SAR"]).default("USD").describe("Project currency"),
});

// Extended validation for WBS Items - use the base schema for extension
export const extendedInsertWbsItemSchema = baseWbsSchema.extend({
  name: z.string().min(3, "WBS item name must be at least 3 characters"),
  duration: z.string().or(z.number()).pipe(z.coerce.number().nonnegative()).optional(),
})
.refine(
  (data) => {
    // Activity types must have startDate, endDate and duration
    if (data.type === "Activity") {
      return (
        data.startDate !== undefined && 
        data.endDate !== undefined && 
        data.duration !== undefined && 
        data.duration > 0
      );
    }
    return true;
  },
  {
    message: "Activity types must have start date, end date, and duration",
    path: ["startDate"],
  }
)
.refine(
  (data) => {
    // Summary and WorkPackage should not have dates
    if (data.type === "Summary" || data.type === "WorkPackage") {
      return (
        data.startDate === undefined && 
        data.endDate === undefined && 
        data.duration === undefined
      );
    }
    return true;
  },
  {
    message: "Summary and WorkPackage types cannot have dates",
    path: ["startDate"],
  }
);

export const updateWbsProgressSchema = z.object({
  id: z.number(),
  percentComplete: z.string().or(z.number()).pipe(
    z.coerce.number().min(0, "Progress must be at least 0%").max(100, "Progress cannot exceed 100%")
  ),
  actualStartDate: z.date().optional(),
  actualEndDate: z.date().optional(),
});

export const importCostsSchema = z.object({
  wbsItemId: z.number(),
  amount: z.string().or(z.number()).pipe(
    z.coerce.number().positive("Amount must be a positive number")
  ),
  description: z.string().optional(),
  entryDate: z.date(),
});

export type UpdateWbsProgress = z.infer<typeof updateWbsProgressSchema>;
export type ImportCosts = z.infer<typeof importCostsSchema>;

// Extended schema for CSV import validation
export const csvImportSchema = z.array(
  z.object({
    wbsCode: z.string().min(1, "WBS code is required"),
    amount: z.string().or(z.number()).pipe(
      z.coerce.number().positive("Amount must be a positive number")
    ),
    description: z.string().optional(),
    entryDate: z.string().transform((val) => new Date(val)),
  })
);

export type CsvImportData = z.infer<typeof csvImportSchema>;
