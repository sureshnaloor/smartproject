import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Project, WbsItem } from "@/types";
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
import { Progress } from "@/components/ui/progress";

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
    enabled: !!projectId,
  });

  // Fetch WBS items for the project
  const { data: wbsItems = [], isLoading: isLoadingWbs } = useQuery<WbsItem[]>({
    queryKey: [`/api/projects/${projectId}/wbs`],
    enabled: !!projectId,
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

  // Calculate earned value metrics
  const earnedValue = {
    budgetedCost: workPackageBudget,
    actualCost: totalActualCost,
    earnedValue: completedValue,
    plannedProgress: expectedProgress / 100,
    actualProgress: overallProgress / 100
  };

  // Calculate performance metrics
  const costPerformanceIndex = calculateCPI(completedValue, totalActualCost);
  const schedulePerformanceIndex = calculateSPI(completedValue, workPackageBudget * 0.45);

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
      <h1 className="text-3xl font-bold mb-8">{project?.name} Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Budget Status</CardTitle>
            <CardDescription>Current budget utilization</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Spent</span>
                <span>{formatCurrency(earnedValue.actualCost, projectCurrency)}</span>
              </div>
              <div className="flex justify-between">
                <span>Budget</span>
                <span>{formatCurrency(earnedValue.budgetedCost, projectCurrency)}</span>
              </div>
              <Progress value={earnedValue.budgetedCost > 0 ? (earnedValue.actualCost / earnedValue.budgetedCost) * 100 : 0} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Schedule Status</CardTitle>
            <CardDescription>Project timeline progress</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Planned Progress</span>
                <span>{formatPercent(earnedValue.plannedProgress)}</span>
              </div>
              <div className="flex justify-between">
                <span>Actual Progress</span>
                <span>{formatPercent(earnedValue.actualProgress)}</span>
              </div>
              <Progress value={earnedValue.actualProgress * 100} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cost Performance</CardTitle>
            <CardDescription>Cost Performance Index (CPI)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>CPI</span>
                <span>{formatPercent(costPerformanceIndex)}</span>
              </div>
              <div className="flex justify-between">
                <span>Status</span>
                <span className={costPerformanceIndex >= 1 ? "text-green-500" : "text-red-500"}>
                  {costPerformanceIndex >= 1 ? "Under Budget" : "Over Budget"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Schedule Performance</CardTitle>
            <CardDescription>Schedule Performance Index (SPI)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>SPI</span>
                <span>{formatPercent(schedulePerformanceIndex)}</span>
              </div>
              <div className="flex justify-between">
                <span>Status</span>
                <span className={schedulePerformanceIndex >= 1 ? "text-green-500" : "text-red-500"}>
                  {schedulePerformanceIndex >= 1 ? "Ahead of Schedule" : "Behind Schedule"}
                </span>
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
