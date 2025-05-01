import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { WbsItem, Project } from "@shared/schema";
import { formatCurrency, formatPercent, calculateEarnedValue } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface CostControlProps {
  projectId: number;
}

export function CostControl({ projectId }: CostControlProps) {
  const [viewMode, setViewMode] = useState<"level1" | "level2" | "all">("level1");

  // Fetch project data
  const { data: project } = useQuery<Project>({
    queryKey: [`/api/projects/${projectId}`],
  });

  // Get the project currency or default to USD if not available
  const projectCurrency = project?.currency || "USD";

  // Fetch WBS items for the project
  const { data: wbsItems = [], isLoading } = useQuery<WbsItem[]>({
    queryKey: [`/api/projects/${projectId}/wbs`],
  });

  // Filter WBS items based on view mode and type
  // Only include Summary and WorkPackage types which have budgets
  const filteredItems = useMemo(() => {
    // First filter by type - only Summary and WorkPackage have budgets
    const budgetableItems = wbsItems.filter(item => 
      item.type === "Summary" || item.type === "WorkPackage"
    );
    
    // Then filter by level
    if (viewMode === "level1") {
      return budgetableItems.filter(item => item.level === 1);
    } else if (viewMode === "level2") {
      return budgetableItems.filter(item => item.level <= 2);
    }
    return budgetableItems;
  }, [wbsItems, viewMode]);

  // Group and sort items
  const groupedItems = useMemo(() => {
    const items = [...filteredItems]
      .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
      
    // Calculate totals
    const totalBudget = items.reduce((sum, item) => sum + Number(item.budgetedCost), 0);
    const totalActual = items.reduce((sum, item) => sum + Number(item.actualCost), 0);
    const totalEarnedValue = items.reduce(
      (sum, item) => sum + calculateEarnedValue(Number(item.budgetedCost), Number(item.percentComplete)),
      0
    );

    return {
      items,
      totalBudget,
      totalActual,
      totalEarnedValue,
      costVariance: totalEarnedValue - totalActual,
      costPerformanceIndex: totalActual > 0 ? totalEarnedValue / totalActual : 1
    };
  }, [filteredItems]);

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-8 w-full max-w-md" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Budget vs Actual Cost */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-semibold">Budget vs Actual Cost</h3>
          <Select
            value={viewMode}
            onValueChange={(value: "level1" | "level2" | "all") => setViewMode(value)}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Select view" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="level1">By WBS Level 1</SelectItem>
              <SelectItem value="level2">By WBS Level 2</SelectItem>
              <SelectItem value="all">All Budgeted Items</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-4">
          {groupedItems.items.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              No budgeted WBS items found. Add Summary or WorkPackage items to see cost data.
            </div>
          ) : (
            <>
              {groupedItems.items.map((item) => (
                <div key={item.id}>
                  <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center">
                      <span className="text-sm font-medium">{item.name}</span>
                      <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                        {item.type}
                      </span>
                    </div>
                    <div className="text-sm">
                      <span className="font-mono">{formatCurrency(item.actualCost, projectCurrency)}</span>
                      <span className="text-gray-500 mx-1">/</span>
                      <span className="font-mono">{formatCurrency(item.budgetedCost, projectCurrency)}</span>
                    </div>
                  </div>
                  <div className="w-full h-6 bg-gray-100 rounded-md overflow-hidden">
                    <div 
                      className={cn(
                        "h-full",
                        Number(item.actualCost) > Number(item.budgetedCost)
                          ? "bg-red-500"
                          : "bg-blue-500"
                      )}
                      style={{ 
                        width: `${Math.min(100, (Number(item.actualCost) / Number(item.budgetedCost)) * 100)}%` 
                      }}
                    ></div>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-xs text-gray-500">
                      {Number(item.budgetedCost) > 0
                        ? formatPercent((Number(item.actualCost) / Number(item.budgetedCost)) * 100)
                        : "0%"} of budget
                    </span>
                    <span className={cn(
                      "text-xs font-medium",
                      Number(item.actualCost) > Number(item.budgetedCost)
                        ? "text-red-600"
                        : "text-green-600"
                    )}>
                      {formatCurrency(Number(item.budgetedCost) - Number(item.actualCost), projectCurrency)} 
                      {Number(item.actualCost) > Number(item.budgetedCost) ? " overrun" : " remaining"}
                    </span>
                  </div>
                </div>
              ))}

              {/* Project Totals */}
              <div className="mt-6 pt-4 border-t border-gray-200">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-semibold">Project Total</span>
                  <div className="text-sm font-semibold">
                    <span className="font-mono">{formatCurrency(groupedItems.totalActual, projectCurrency)}</span>
                    <span className="text-gray-500 mx-1">/</span>
                    <span className="font-mono">{formatCurrency(groupedItems.totalBudget, projectCurrency)}</span>
                  </div>
                </div>
                <div className="w-full h-6 bg-gray-100 rounded-md overflow-hidden">
                  <div 
                    className={cn(
                      "h-full",
                      groupedItems.totalActual > groupedItems.totalBudget
                        ? "bg-red-500"
                        : "bg-blue-500"
                    )}
                    style={{ 
                      width: `${Math.min(100, (groupedItems.totalActual / groupedItems.totalBudget) * 100)}%` 
                    }}
                  ></div>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-xs text-gray-500">
                    {formatPercent((groupedItems.totalActual / groupedItems.totalBudget) * 100)} of budget
                  </span>
                  <span className={cn(
                    "text-xs font-medium",
                    groupedItems.totalActual > groupedItems.totalBudget
                      ? "text-red-600"
                      : "text-green-600"
                  )}>
                    {formatCurrency(groupedItems.totalBudget - groupedItems.totalActual, projectCurrency)} 
                    {groupedItems.totalActual > groupedItems.totalBudget ? " overrun" : " remaining"}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      
      {/* Cost Variance Analysis */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-semibold">Cost Variance Analysis</h3>
          <div className="text-sm text-gray-500">
            Last updated: {new Date().toLocaleDateString()}
          </div>
        </div>
        
        <div className="space-y-6">
          {/* Cost Performance Index */}
          <div>
            <h4 className="text-sm font-medium mb-2">Cost Performance Index (CPI)</h4>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-semibold font-mono">
                {groupedItems.costPerformanceIndex.toFixed(2)}
              </div>
              <div className={cn(
                "px-2 py-1 rounded text-sm font-medium",
                groupedItems.costPerformanceIndex >= 1
                  ? "bg-green-100 text-green-800"
                  : "bg-red-100 text-red-800"
              )}>
                {groupedItems.costPerformanceIndex >= 1.1
                  ? "Excellent"
                  : groupedItems.costPerformanceIndex >= 1
                  ? "On Budget"
                  : groupedItems.costPerformanceIndex >= 0.9
                  ? "Slightly Over"
                  : "Over Budget"}
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              CPI = Earned Value / Actual Cost
              {groupedItems.costPerformanceIndex < 1 
                ? ". A value less than 1 indicates the project is over budget."
                : ". A value greater than 1 indicates the project is under budget."}
            </div>
          </div>
          
          {/* Earned Value */}
          <div>
            <h4 className="text-sm font-medium mb-2">Earned Value</h4>
            <div className="text-2xl font-semibold font-mono">
              {formatCurrency(groupedItems.totalEarnedValue, projectCurrency)}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Value of work completed based on budget and progress
            </div>
          </div>
          
          {/* Cost Variance */}
          <div>
            <h4 className="text-sm font-medium mb-2">Cost Variance</h4>
            <div className="flex items-center">
              <div className="text-2xl font-semibold font-mono">
                {groupedItems.costVariance > 0 ? "+" : ""}
                {formatCurrency(groupedItems.costVariance, projectCurrency)}
              </div>
              <div className={cn(
                "ml-3 px-2 py-1 rounded text-sm font-medium",
                groupedItems.costVariance >= 0
                  ? "bg-green-100 text-green-800"
                  : "bg-red-100 text-red-800"
              )}>
                {groupedItems.costVariance >= 0 ? "Under Budget" : "Over Budget"}
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Difference between earned value and actual cost
            </div>
          </div>
          
          {/* Notes */}
          <div className="p-3 bg-blue-50 rounded-md text-sm text-blue-700 mt-4">
            <p className="font-medium mb-1">Note:</p>
            <p>
              This analysis only considers Summary and WorkPackage items with budgets. 
              Activity items do not have associated budgets in the new structure.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
