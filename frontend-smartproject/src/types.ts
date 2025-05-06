// Re-export types from backend schema
export type {
  Project,
  InsertProject,
  WbsItem,
  InsertWbsItem,
  Dependency,
  InsertDependency,
  CostEntry,
  InsertCostEntry,
  Task,
  InsertTask,
  UpdateWbsProgress,
  ImportCosts,
  CsvImportData
} from '@backend/schema';

// Re-export schemas
export {
  insertProjectSchema,
  insertWbsItemSchema,
  insertDependencySchema,
  insertCostEntrySchema,
  insertTaskSchema,
  csvImportSchema
} from '@backend/schema'; 