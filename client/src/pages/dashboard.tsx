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

export default function Dashboard() {
  const params = useParams();
  const projectId = params.projectId ? parseInt(params.projectId) : 0;
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
        
        {/* Schedule Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-gray-500">Schedule Progress</p>
                <h3 className="text-2xl font-semibold mt-1">{formatPercent(overallProgress)}</h3>
              </div>
              <div className="bg-blue-50 p-2 rounded-md text-primary-600">
                <Calendar className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">Expected:</span>
                <span className="font-medium">
                  {formatPercent(expectedProgress)} 
                  <span className={progressStatus.textColor}>
                    ({overallProgress >= expectedProgress ? '+' : ''}
                    {formatPercent(overallProgress - expectedProgress)})
                  </span>
                </span>
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
                <p className="text-sm font-medium text-gray-500">Cost Performance (CPI)</p>
                <h3 className="text-2xl font-semibold mt-1">{costPerformanceIndex.toFixed(2)}</h3>
              </div>
              <div className={`bg-${costStatus.textColor.replace('text-', '')}-50 p-2 rounded-md ${costStatus.textColor}`}>
                <ChartLine className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">Status:</span>
                <span className={`font-medium ${costStatus.textColor}`}>{costStatus.status}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                <div 
                  className={`${costStatus.textColor.replace('text-', 'bg-')} h-2 rounded-full`} 
                  style={{ width: `${Math.min(100, costPerformanceIndex * 100)}%` }}
                ></div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Schedule Performance Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-gray-500">Schedule Performance (SPI)</p>
                <h3 className="text-2xl font-semibold mt-1">{schedulePerformanceIndex.toFixed(2)}</h3>
              </div>
              <div className={`bg-${scheduleStatus.textColor.replace('text-', '')}-50 p-2 rounded-md ${scheduleStatus.textColor}`}>
                <Hourglass className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">Status:</span>
                <span className={`font-medium ${scheduleStatus.textColor}`}>{scheduleStatus.status}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                <div 
                  className={`${scheduleStatus.textColor.replace('text-', 'bg-')} h-2 rounded-full`} 
                  style={{ width: `${Math.min(100, schedulePerformanceIndex * 100)}%` }}
                ></div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Project Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* WBS Progress */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex justify-between items-center">
              <CardTitle>WBS Progress</CardTitle>
              <Select
                value={wbsLevel}
                onValueChange={(value: "level1" | "level2" | "all") => setWbsLevel(value)}
              >
                <SelectTrigger className="w-[160px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="level1">Top-level WBS</SelectItem>
                  <SelectItem value="level2">Level 2 WBS</SelectItem>
                  <SelectItem value="all">All Levels</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-5">
              {filteredWbsItems.length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  No WBS items found. Add WBS items to see progress.
                </div>
              ) : (
                filteredWbsItems.map((item) => {
                  const earnedValue = calculateEarnedValue(
                    Number(item.budgetedCost),
                    Number(item.percentComplete)
                  );
                  
                  return (
                    <div key={item.id} className="relative">
                      <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center">
                          <div className="font-medium text-gray-900">
                            {item.name} 
                            <span className="ml-1 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                              {item.type}
                          </span>
                          </div>
                        </div>
                        <div className="text-sm font-medium">
                          {formatPercent(item.percentComplete)}
                        </div>
                      </div>
                      
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div 
                          className="bg-primary-600 h-2.5 rounded-full" 
                          style={{ width: `${Math.min(100, Number(item.percentComplete))}%` }}
                        ></div>
                      </div>
                      
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>
                          {formatCurrency(earnedValue, projectCurrency)} / {formatCurrency(item.budgetedCost, projectCurrency)}
                        </span>
                        <span>
                          {formatDate(item.startDate)} - {formatDate(item.endDate)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
        
        {/* Upcoming Activities */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex justify-between items-center">
              <CardTitle>Upcoming Activities</CardTitle>
              <Button variant="link" className="p-0 h-auto">View All</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {wbsItems.filter(item => item.type === "Activity" && Number(item.percentComplete) < 100)
                .slice(0, 5)
                .map(activity => (
                  <div key={activity.id} className="flex items-start space-x-3">
                    <div className="flex-shrink-0 mt-1">
                      <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                    </div>
                    <div>
                      <div className="font-medium text-sm">{activity.name}</div>
                      <div className="flex items-center text-xs text-gray-500 mt-1">
                        <Calendar className="h-3 w-3 mr-1" />
                        <span>{formatDate(activity.startDate)} - {formatDate(activity.endDate)}</span>
                      </div>
                    </div>
                  </div>
                ))
              }
              {wbsItems.filter(item => item.type === "Activity" && Number(item.percentComplete) < 100).length === 0 && (
                <div className="text-center py-4 text-gray-500">
                  No upcoming activities found.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        
        {/* Cost Overview */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <CardTitle>Cost Overview</CardTitle>
            {!isBudgetFinalized && (
              <CardDescription className="text-amber-600 flex items-center">
                <AlertCircle className="h-4 w-4 mr-1" />
                Budget allocation is in progress. Values may not be finalized.
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row md:divide-x divide-gray-200 md:space-x-6">
              {/* Budget & Actual */}
              <div className="flex-1 mb-6 md:mb-0 md:pr-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Budget */}
                  <div>
                    <h4 className="text-sm font-medium mb-2">Allocated Budget</h4>
                    <div className="text-2xl font-semibold font-mono">
                      {isBudgetFinalized 
                        ? formatCurrency(workPackageBudget, projectCurrency)
                        : <span className="text-base text-amber-600">Not yet finalized</span>
                      }
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {isBudgetFinalized 
                        ? "Total budget allocated to work packages"
                        : "Run 'Finalize Budget' in WBS tab to complete allocation"
                      }
                    </div>
                  </div>
                  
                  {/* Actual Cost */}
                          <div>
                    <h4 className="text-sm font-medium mb-2">Actual Cost</h4>
                    <div className="text-2xl font-semibold font-mono">
                      {formatCurrency(totalActualCost, projectCurrency)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Total spent to date across work packages
                    </div>
                  </div>
                          </div>
                
                {/* Progress Bar */}
                {isBudgetFinalized && (
                  <div className="mt-6">
                    <div className="flex justify-between items-center text-sm mb-2">
                      <span className="font-medium">Budget Usage</span>
                      <span className="text-gray-500">
                        {formatPercent(workPackageBudget > 0 ? (totalActualCost / workPackageBudget) * 100 : 0)}
                          </span>
                        </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div 
                        className={`h-2.5 rounded-full ${totalActualCost > workPackageBudget ? 'bg-red-500' : 'bg-primary-600'}`}
                        style={{ width: `${Math.min(100, workPackageBudget > 0 ? (totalActualCost / workPackageBudget) * 100 : 0)}%` }}
                      ></div>
                        </div>
                      </div>
                )}
              </div>
              
              {/* Earned Value */}
              <div className="flex-1 md:px-6">
                <div>
                  <h4 className="text-sm font-medium mb-2">Earned Value</h4>
                  <div className="text-2xl font-semibold font-mono">
                    {formatCurrency(completedValue, projectCurrency)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Value of work completed based on budget and progress
                  </div>
                </div>
                
                {/* Cost Variance */}
                <div className="mt-6">
                  <h4 className="text-sm font-medium mb-2">Cost Variance</h4>
                  <div className="flex items-center">
                    <div className="text-2xl font-semibold font-mono">
                      {completedValue - totalActualCost > 0 ? "+" : ""}
                      {formatCurrency(completedValue - totalActualCost, projectCurrency)}
                    </div>
                    <div className={`ml-3 px-2 py-1 rounded text-sm font-medium ${
                      completedValue - totalActualCost >= 0 
                        ? "bg-green-100 text-green-800" 
                        : "bg-red-100 text-red-800"
                    }`}>
                      {completedValue - totalActualCost >= 0 ? "Under Budget" : "Over Budget"}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Difference between earned value and actual cost
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
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
