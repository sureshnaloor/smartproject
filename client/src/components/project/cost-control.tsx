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

  // Fetch WBS items for the project
  const { data: wbsItems = [], isLoading } = useQuery<WbsItem[]>({
    queryKey: [`/api/projects/${projectId}/wbs`],
  });

  // Filter WBS items based on view mode
  const filteredItems = useMemo(() => {
    if (viewMode === "level1") {
      return wbsItems.filter(item => item.level === 1);
    } else if (viewMode === "level2") {
      return wbsItems.filter(item => item.level <= 2);
    }
    return wbsItems;
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
              <SelectItem value="all">All WBS Items</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-4">
          {groupedItems.items.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              No WBS items found. Add items to see cost data.
            </div>
          ) : (
            <>
              {groupedItems.items.map((item) => (
                <div key={item.id}>
                  <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center">
                      <span className="text-sm font-medium">{item.name}</span>
                      {item.level === 1 && (
                        <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">Level 1</span>
                      )}
                    </div>
                    <div className="text-sm">
                      <span className="font-mono">{formatCurrency(item.actualCost)}</span>
                      <span className="text-gray-500 mx-1">/</span>
                      <span className="font-mono">{formatCurrency(item.budgetedCost)}</span>
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
                      {formatCurrency(Number(item.budgetedCost) - Number(item.actualCost))} 
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
                    <span className="font-mono">{formatCurrency(groupedItems.totalActual)}</span>
                    <span className="text-gray-500 mx-1">/</span>
                    <span className="font-mono">{formatCurrency(groupedItems.totalBudget)}</span>
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
                    {formatCurrency(groupedItems.totalBudget - groupedItems.totalActual)} 
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
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">WBS Element</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Planned Value</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Earned Value</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actual Cost</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">CV</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">CPI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {groupedItems.items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-gray-500 py-4">
                    No WBS items found. Add items to see variance analysis.
                  </td>
                </tr>
              ) : (
                <>
                  {groupedItems.items.map(item => {
                    const earnedValue = calculateEarnedValue(
                      Number(item.budgetedCost),
                      Number(item.percentComplete)
                    );
                    const costVariance = earnedValue - Number(item.actualCost);
                    const cpi = Number(item.actualCost) > 0
                      ? earnedValue / Number(item.actualCost)
                      : 1;
                    
                    return (
                      <tr key={item.id}>
                        <td className="px-3 py-2 text-sm font-medium">{item.name}</td>
                        <td className="px-3 py-2 text-sm text-right font-mono">
                          {formatCurrency(item.budgetedCost)}
                        </td>
                        <td className="px-3 py-2 text-sm text-right font-mono">
                          {formatCurrency(earnedValue)}
                        </td>
                        <td className="px-3 py-2 text-sm text-right font-mono">
                          {formatCurrency(item.actualCost)}
                        </td>
                        <td className={cn(
                          "px-3 py-2 text-sm text-right font-mono",
                          costVariance < 0 ? "text-red-600" : "text-green-600"
                        )}>
                          {costVariance < 0 ? "-" : "+"}
                          {formatCurrency(Math.abs(costVariance))}
                        </td>
                        <td className={cn(
                          "px-3 py-2 text-sm text-right",
                          cpi < 1 ? "text-red-600" : "text-green-600"
                        )}>
                          {cpi.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                  
                  {/* Project Totals */}
                  <tr className="bg-gray-50">
                    <td className="px-3 py-2 text-sm font-semibold">Project Total</td>
                    <td className="px-3 py-2 text-sm text-right font-semibold font-mono">
                      {formatCurrency(groupedItems.totalBudget)}
                    </td>
                    <td className="px-3 py-2 text-sm text-right font-semibold font-mono">
                      {formatCurrency(groupedItems.totalEarnedValue)}
                    </td>
                    <td className="px-3 py-2 text-sm text-right font-semibold font-mono">
                      {formatCurrency(groupedItems.totalActual)}
                    </td>
                    <td className={cn(
                      "px-3 py-2 text-sm text-right font-semibold font-mono",
                      groupedItems.costVariance < 0 ? "text-red-600" : "text-green-600"
                    )}>
                      {groupedItems.costVariance < 0 ? "-" : "+"}
                      {formatCurrency(Math.abs(groupedItems.costVariance))}
                    </td>
                    <td className={cn(
                      "px-3 py-2 text-sm text-right font-semibold",
                      groupedItems.costPerformanceIndex < 1 ? "text-red-600" : "text-green-600"
                    )}>
                      {groupedItems.costPerformanceIndex.toFixed(2)}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
        
        <div className="mt-4 text-sm text-gray-500">
          <p>CV = Earned Value - Actual Cost</p>
          <p>CPI = Earned Value / Actual Cost</p>
        </div>
      </div>
    </div>
  );
}
