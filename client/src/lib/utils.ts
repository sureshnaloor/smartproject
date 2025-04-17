import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { addDays, format, isBefore, isAfter, differenceInDays } from "date-fns";
import { WbsItem, Dependency } from "@shared/schema";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined) return "$0.00";
  
  const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
  
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(numAmount);
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "";
  
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return format(dateObj, "MMM d, yyyy");
}

export function formatShortDate(date: Date | string | null | undefined): string {
  if (!date) return "";
  
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return format(dateObj, "MM/dd/yyyy");
}

export function formatPercent(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "0%";
  
  const numValue = typeof value === "string" ? parseFloat(value) : value;
  
  return `${Math.round(numValue)}%`;
}

export function getStatusColor(plannedProgress: number, actualProgress: number): {
  color: string;
  status: string;
  textColor: string;
  bgColor: string;
} {
  const diff = actualProgress - plannedProgress;
  
  if (diff >= 0) {
    return {
      color: "bg-green-500",
      status: "On Track",
      textColor: "text-green-600",
      bgColor: "bg-green-100",
    };
  } else if (diff >= -5) {
    return {
      color: "bg-amber-500",
      status: "Slightly Behind",
      textColor: "text-amber-600",
      bgColor: "bg-amber-100",
    };
  } else {
    return {
      color: "bg-red-500",
      status: "Behind Schedule",
      textColor: "text-red-600",
      bgColor: "bg-red-100",
    };
  }
}

export function calculateCPI(earnedValue: number, actualCost: number): number {
  if (actualCost === 0) return 1;
  return Number((earnedValue / actualCost).toFixed(2));
}

export function calculateSPI(earnedValue: number, plannedValue: number): number {
  if (plannedValue === 0) return 1;
  return Number((earnedValue / plannedValue).toFixed(2));
}

export function getPerformanceStatus(value: number): {
  status: string;
  textColor: string;
} {
  if (value >= 1.05) {
    return { status: "Excellent", textColor: "text-green-600" };
  } else if (value >= 1) {
    return { status: "On Target", textColor: "text-green-600" };
  } else if (value >= 0.95) {
    return { status: "Slightly Behind", textColor: "text-amber-600" };
  } else {
    return { status: "Behind Schedule", textColor: "text-red-600" };
  }
}

export function calculateEarnedValue(budgetedCost: number, percentComplete: number): number {
  return budgetedCost * (percentComplete / 100);
}

export function buildWbsHierarchy(items: WbsItem[]): WbsItem[] {
  // Create a map of item ID to item
  const itemMap = new Map<number, WbsItem & { children: WbsItem[] }>();
  
  // Initialize all items with empty children array
  items.forEach(item => {
    itemMap.set(item.id, { ...item, children: [] });
  });
  
  // Build the hierarchy
  const roots: WbsItem[] = [];
  
  itemMap.forEach(item => {
    if (item.parentId === null) {
      roots.push(item);
    } else {
      const parent = itemMap.get(item.parentId);
      if (parent) {
        parent.children.push(item);
      }
    }
  });
  
  return roots;
}

export function calculateDependencyConstraints(
  wbsItems: WbsItem[],
  dependencies: Dependency[]
): WbsItem[] {
  // Create a map for quick lookup
  const itemMap = new Map<number, WbsItem>();
  wbsItems.forEach(item => {
    itemMap.set(item.id, { ...item });
  });
  
  // Group dependencies by successor
  const successorDeps = new Map<number, Dependency[]>();
  
  dependencies.forEach(dep => {
    const sucDeps = successorDeps.get(dep.successorId) || [];
    sucDeps.push(dep);
    successorDeps.set(dep.successorId, sucDeps);
  });
  
  // Update constraints based on dependencies
  const updatedItems = [...wbsItems];
  
  updatedItems.forEach(item => {
    const deps = successorDeps.get(item.id);
    
    if (deps && deps.length > 0) {
      // Find the latest end date among predecessors
      let latestEndDate = new Date(0);
      
      deps.forEach(dep => {
        const predecessor = itemMap.get(dep.predecessorId);
        
        if (predecessor) {
          const predEndDate = new Date(predecessor.endDate);
          
          // Add lag if specified
          const endDateWithLag = addDays(predEndDate, dep.lag || 0);
          
          if (isAfter(endDateWithLag, latestEndDate)) {
            latestEndDate = endDateWithLag;
          }
        }
      });
      
      // If the constraint pushes start date, update it
      const itemStartDate = new Date(item.startDate);
      
      if (isAfter(latestEndDate, itemStartDate)) {
        const newStartDate = latestEndDate;
        const duration = item.duration;
        const newEndDate = addDays(newStartDate, duration);
        
        // Update the item
        const index = updatedItems.findIndex(i => i.id === item.id);
        if (index !== -1) {
          updatedItems[index] = {
            ...item,
            startDate: newStartDate,
            endDate: newEndDate,
          };
        }
      }
    }
  });
  
  return updatedItems;
}

export function isValidDate(dateString: string): boolean {
  const date = new Date(dateString);
  return !isNaN(date.getTime());
}

export function calculateDuration(startDate: Date, endDate: Date): number {
  return differenceInDays(endDate, startDate) + 1; // Include both start and end days
}

export function isValidDependency(
  predecessorId: number,
  successorId: number,
  wbsItems: WbsItem[],
  dependencies: Dependency[]
): boolean {
  // Cannot create a dependency with itself
  if (predecessorId === successorId) {
    return false;
  }
  
  // Check if dependency already exists
  const dependencyExists = dependencies.some(
    dep => dep.predecessorId === predecessorId && dep.successorId === successorId
  );
  
  if (dependencyExists) {
    return false;
  }
  
  // Check for circular dependencies
  const visited = new Set<number>();
  const stack = new Set<number>();
  
  function hasCycle(current: number): boolean {
    if (stack.has(current)) {
      return true;
    }
    
    if (visited.has(current)) {
      return false;
    }
    
    visited.add(current);
    stack.add(current);
    
    const outgoingDeps = dependencies.filter(dep => dep.predecessorId === current);
    
    for (const dep of outgoingDeps) {
      if (hasCycle(dep.successorId)) {
        return true;
      }
    }
    
    stack.delete(current);
    return false;
  }
  
  // Add the potential new dependency temporarily
  dependencies.push({ id: -1, predecessorId, successorId, type: "FS", lag: 0, createdAt: new Date() });
  
  const result = hasCycle(successorId);
  
  // Remove the temporary dependency
  dependencies.pop();
  
  return !result;
}
