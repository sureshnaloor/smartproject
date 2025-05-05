// Simple in-memory storage for testing

// Mock data
const projects = [
  { id: 1, name: "Sample Project 1", description: "This is a sample project", budget: 100000, startDate: "2025-01-01", endDate: "2025-12-31", currency: "USD" },
  { id: 2, name: "Sample Project 2", description: "This is another sample project", budget: 200000, startDate: "2025-02-01", endDate: "2025-11-30", currency: "EUR" }
];

const wbsItems = [
  { id: 1, projectId: 1, name: "Engineering Phase", level: 1, code: "1.0", type: "Summary", budgetedCost: 20000, actualCost: 0, percentComplete: "0", description: "All engineering activities", isTopLevel: true, parentId: null, startDate: "2025-01-01", endDate: "2025-03-31", duration: 90 },
  { id: 2, projectId: 1, name: "Construction Phase", level: 1, code: "2.0", type: "Summary", budgetedCost: 50000, actualCost: 0, percentComplete: "0", description: "All construction activities", isTopLevel: true, parentId: null, startDate: "2025-04-01", endDate: "2025-10-31", duration: 214 },
  { id: 3, projectId: 1, name: "Commissioning", level: 1, code: "3.0", type: "Summary", budgetedCost: 30000, actualCost: 0, percentComplete: "0", description: "Testing and commissioning", isTopLevel: true, parentId: null, startDate: "2025-11-01", endDate: "2025-12-31", duration: 61 },
  { id: 4, projectId: 2, name: "Planning", level: 1, code: "1.0", type: "Summary", budgetedCost: 40000, actualCost: 0, percentComplete: "0", description: "Project planning activities", isTopLevel: true, parentId: null, startDate: "2025-02-01", endDate: "2025-04-30", duration: 89 },
  { id: 5, projectId: 2, name: "Implementation", level: 1, code: "2.0", type: "Summary", budgetedCost: 160000, actualCost: 0, percentComplete: "0", description: "Project implementation", isTopLevel: true, parentId: null, startDate: "2025-05-01", endDate: "2025-11-30", duration: 214 }
];

const tasks = [
  { id: 1, projectId: 1, activityId: 1, name: "Engineering Drawings", description: "Create detailed engineering drawings", startDate: "2025-01-01", endDate: "2025-02-15", duration: 45, percentComplete: "0" },
  { id: 2, projectId: 1, activityId: 1, name: "Engineering Review", description: "Review and approve engineering drawings", startDate: "2025-02-16", endDate: "2025-03-31", duration: 44, percentComplete: "0" },
  { id: 3, projectId: 1, activityId: 2, name: "Site Preparation", description: "Prepare the construction site", startDate: "2025-04-01", endDate: "2025-05-15", duration: 45, percentComplete: "0" },
  { id: 4, projectId: 2, activityId: 4, name: "Requirement Analysis", description: "Analyze project requirements", startDate: "2025-02-01", endDate: "2025-03-15", duration: 43, percentComplete: "0" }
];

// Simple storage class
export class DatabaseStorage {
  // Project methods
  getProjects() {
    return [...projects];
  }

  getProject(id: number) {
    return projects.find(p => p.id === id) || null;
  }

  createProject(projectData: any) {
    const newId = projects.length > 0 ? Math.max(...projects.map(p => p.id)) + 1 : 1;
    const newProject = { ...projectData, id: newId };
    projects.push(newProject);
    return newProject;
  }

  updateProject(id: number, projectData: any) {
    const index = projects.findIndex(p => p.id === id);
    if (index === -1) return null;
    
    const updatedProject = { ...projects[index], ...projectData };
    projects[index] = updatedProject;
    return updatedProject;
  }

  deleteProject(id: number) {
    const index = projects.findIndex(p => p.id === id);
    if (index === -1) return false;
    
    projects.splice(index, 1);
    return true;
  }

  // WBS methods
  getWbsItems(projectId: number) {
    return wbsItems.filter(item => item.projectId === projectId);
  }

  getWbsItem(id: number) {
    return wbsItems.find(item => item.id === id) || null;
  }

  createWbsItem(wbsItemData: any) {
    const newId = wbsItems.length > 0 ? Math.max(...wbsItems.map(item => item.id)) + 1 : 1;
    
    // Set default values if not provided
    const defaults = {
      level: 1,
      code: `${newId}.0`,
      type: "Summary",
      budgetedCost: 0,
      actualCost: 0,
      percentComplete: "0",
      isTopLevel: false,
      parentId: null,
      duration: 30
    };
    
    const newWbsItem = { ...defaults, ...wbsItemData, id: newId };
    wbsItems.push(newWbsItem);
    return newWbsItem;
  }
  
  updateWbsItem(id: number, wbsItemData: any) {
    const index = wbsItems.findIndex(item => item.id === id);
    if (index === -1) return null;
    
    const updatedWbsItem = { ...wbsItems[index], ...wbsItemData };
    wbsItems[index] = updatedWbsItem;
    return updatedWbsItem;
  }
  
  deleteWbsItem(id: number) {
    const index = wbsItems.findIndex(item => item.id === id);
    if (index === -1) return false;
    
    // Check if this WBS item has children
    const hasChildren = wbsItems.some(item => item.parentId === id);
    if (hasChildren) {
      throw new Error("Cannot delete WBS item with children");
    }
    
    wbsItems.splice(index, 1);
    return true;
  }

  // Task methods
  getTasks(projectId: number) {
    return tasks.filter(task => task.projectId === projectId);
  }

  getTasksByActivity(activityId: number) {
    return tasks.filter(task => task.activityId === activityId);
  }

  getTask(id: number) {
    return tasks.find(task => task.id === id) || null;
  }

  createTask(taskData: any) {
    const newId = tasks.length > 0 ? Math.max(...tasks.map(task => task.id)) + 1 : 1;
    
    // Set default values if not provided
    const defaults = {
      percentComplete: "0",
      duration: 30
    };
    
    const newTask = { ...defaults, ...taskData, id: newId };
    tasks.push(newTask);
    return newTask;
  }
}

// Export a singleton instance
export const storage = new DatabaseStorage(); 