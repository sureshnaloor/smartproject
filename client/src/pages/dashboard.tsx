import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Project, WbsItem } from "@shared/schema";
import { 
  formatCurrency, 
  formatDate, 
  formatPercent, 
  getStatusColor, 
  calculateCPI, 
  calculateSPI, 
  getPerformanceStatus,
  calculateEarnedValue
} from "@/lib/utils";
import {
  Building,
  Calendar,
  DollarSign,
  ChartLine,
  Hourglass,
  ExpandIcon,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { GanttChart } from "@/components/project/gantt-chart";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";

interface DashboardProps {
  projectId?: number;
}

export default function Dashboard({ projectId: propProjectId }: DashboardProps) {
  // If projectId is provided as a prop, use it; otherwise get it from URL params
  const params = useParams();
  const projectId = propProjectId !== undefined ? propProjectId : (params.projectId ? parseInt(params.projectId) : 0);
  
  const [wbsLevel, setWbsLevel] = useState<"level1" | "level2" | "all">("level1");

  // Fetch project data
  const { data: project, isLoading: isLoadingProject } = useQuery<Project>({
    queryKey: [`/api/projects/${projectId}`],
  });

  // Fetch WBS items for the project
  const { data: wbsItems = [], isLoading: isLoadingWbs } = useQuery<WbsItem[]>({
    queryKey: [`/api/projects/${projectId}/wbs`],
  });

  // Filter WBS items based on level selection
  const filteredWbsItems = wbsItems.filter(item => {
    if (wbsLevel === "level1") return item.level === 1;
    if (wbsLevel === "level2") return item.level <= 2;
    return true;
  });

  // Calculate budget values correctly
  const projectBudget = project?.budget ? Number(project.budget) : 0;
  
  // Get only work package budgets (no summary items)
  const workPackageBudget = wbsItems
    .filter(item => item.type === "WorkPackage")
    .reduce((sum, item) => sum + Number(item.budgetedCost), 0);
  
  // Get total actual cost (from work packages only)
  const totalActualCost = wbsItems
    .filter(item => item.type === "WorkPackage")
    .reduce((sum, item) => sum + Number(item.actualCost), 0);
  
  // Check if budget is finalized (sum of top-level summary items equals work package total)
  const topLevelSummaryBudget = wbsItems
    .filter(item => item.type === "Summary" && item.isTopLevel)
    .reduce((sum, item) => sum + Number(item.budgetedCost), 0);
  
  const isBudgetFinalized = Math.abs(topLevelSummaryBudget - workPackageBudget) < 0.01;
  
  // Calculate earned value based on work packages only
  const completedValue = wbsItems
    .filter(item => item.type === "WorkPackage")
    .reduce(
    (sum, item) => sum + (Number(item.budgetedCost) * Number(item.percentComplete) / 100), 
    0
  );
  
  const overallProgress = workPackageBudget > 0 ? (completedValue / workPackageBudget) * 100 : 0;
  const expectedProgress = 45; // This would normally be calculated based on current date vs. schedule

  // Calculate performance metrics
  const costPerformanceIndex = calculateCPI(completedValue, totalActualCost);
  const schedulePerformanceIndex = calculateSPI(completedValue, workPackageBudget * 0.45); // 45% is expected progress
  
  // Get status colors and text
  const progressStatus = getStatusColor(expectedProgress, overallProgress);
  const costStatus = getPerformanceStatus(costPerformanceIndex);
  const scheduleStatus = getPerformanceStatus(schedulePerformanceIndex);

  const isLoading = isLoadingProject || isLoadingWbs;

  if (isLoading) {
    return (
      <div className="p-4 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-[140px] w-full" />
          ))}
        </div>
        <Skeleton className="h-[300px] w-full" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-[400px] w-full lg:col-span-2" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      </div>
    );
  }

  // Get the project currency or default to USD if not available
  const projectCurrency = project?.currency || "USD";

  return (
    <div className="flex-1 overflow-auto p-4 bg-gray-50">
      {/* Dashboard Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Budget Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-gray-500">Project Budget</p>
                <h3 className="text-2xl font-semibold font-mono mt-1">{formatCurrency(projectBudget, projectCurrency)}</h3>
              </div>
              <div className="bg-blue-50 p-2 rounded-md text-primary-600">
                <DollarSign className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">Allocated:</span>
                {isBudgetFinalized ? (
                <span className="font-medium font-mono">
                    {formatCurrency(workPackageBudget, projectCurrency)} 
                    ({formatPercent(projectBudget > 0 ? (workPackageBudget / projectBudget) * 100 : 0)})
                  </span>
                ) : (
                  <span className="font-medium text-amber-600 flex items-center">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Budget allocation in progress
                </span>
                )}
              </div>
              {isBudgetFinalized && (
              <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                <div 
                    className={`bg-primary-600 h-2 rounded-full ${workPackageBudget > projectBudget ? 'bg-red-500' : ''}`}
                    style={{ 
                      width: `${Math.min(100, projectBudget > 0 ? (workPackageBudget / projectBudget) * 100 : 0)}%` 
                    }}
                ></div>
              </div>
              )}
            </div>
          </CardContent>
        </Card>
        
        {/* Actual Cost Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-gray-500">Actual Cost</p>
                <h3 className="text-2xl font-semibold font-mono mt-1">{formatCurrency(totalActualCost, projectCurrency)}</h3>
              </div>
              <div className="bg-green-50 p-2 rounded-md text-green-600">
                <DollarSign className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">Budget Used:</span>
                <span className="font-medium">{formatPercent(projectBudget > 0 ? (totalActualCost / projectBudget) * 100 : 0)}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                <div 
                  className={`h-2 rounded-full ${
                    totalActualCost > projectBudget ? 'bg-red-500' : 'bg-green-500'
                  }`}
                  style={{ 
                    width: `${Math.min(100, projectBudget > 0 ? (totalActualCost / projectBudget) * 100 : 0)}%` 
                  }}
                ></div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Progress Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-gray-500">Progress</p>
                <h3 className="text-2xl font-semibold font-mono mt-1">{formatPercent(overallProgress)}</h3>
              </div>
              <div className={`p-2 rounded-md ${progressStatus.bgColor}`}>
                <Hourglass className={`h-5 w-5 ${progressStatus.textColor}`} />
              </div>
            </div>
            <div className="mt-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">Expected:</span>
                <span className="font-medium">{formatPercent(expectedProgress)}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                <div 
                  className={`${progressStatus.color} h-2 rounded-full`}
                  style={{ width: `${Math.min(100, overallProgress)}%` }}
                ></div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Performance Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-gray-500">Performance</p>
                <div className="flex items-center mt-1">
                  <div className="mr-2">
                    <span className="text-xs text-gray-500">CPI</span>
                    <div className={`text-lg font-medium ${costStatus.textColor}`}>
                      {costPerformanceIndex.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">SPI</span>
                    <div className={`text-lg font-medium ${scheduleStatus.textColor}`}>
                      {schedulePerformanceIndex.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-purple-50 p-2 rounded-md text-purple-600">
                <ChartLine className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="flex flex-col gap-1 text-sm">
                <div className="flex items-center">
                  <span className={`w-2 h-2 rounded-full ${costStatus.textColor.replace('text-', 'bg-')} mr-1`}></span>
                  <span className="text-gray-500 mr-1">Cost:</span>
                  <span className={`font-medium ${costStatus.textColor}`}>{costStatus.status}</span>
                </div>
                <div className="flex items-center">
                  <span className={`w-2 h-2 rounded-full ${scheduleStatus.textColor.replace('text-', 'bg-')} mr-1`}></span>
                  <span className="text-gray-500 mr-1">Schedule:</span>
                  <span className={`font-medium ${scheduleStatus.textColor}`}>{scheduleStatus.status}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* WBS Filter Dropdown */}
      <div className="flex justify-end mb-4">
        <div className="w-48">
          <Select 
            value={wbsLevel}
            onValueChange={(value: any) => setWbsLevel(value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Detail Level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="level1">Level 1 (Summary)</SelectItem>
              <SelectItem value="level2">Level 2</SelectItem>
              <SelectItem value="all">All Levels</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      {/* Gantt Chart */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle>Project Timeline</CardTitle>
          <CardDescription>
            Timeline view of work packages and activities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <GanttChart 
              projectId={projectId}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
