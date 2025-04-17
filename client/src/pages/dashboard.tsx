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
  const projectId = parseInt(params.projectId);
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

  // Calculate overall progress
  const totalBudget = wbsItems.reduce((sum, item) => sum + Number(item.budgetedCost), 0);
  const totalActualCost = wbsItems.reduce((sum, item) => sum + Number(item.actualCost), 0);
  const completedValue = wbsItems.reduce(
    (sum, item) => sum + (Number(item.budgetedCost) * Number(item.percentComplete) / 100), 
    0
  );
  
  const overallProgress = totalBudget > 0 ? (completedValue / totalBudget) * 100 : 0;
  const expectedProgress = 45; // This would normally be calculated based on current date vs. schedule

  // Calculate performance metrics
  const costPerformanceIndex = calculateCPI(completedValue, totalActualCost);
  const schedulePerformanceIndex = calculateSPI(completedValue, totalBudget * 0.45); // 45% is expected progress
  
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

  return (
    <div className="flex-1 overflow-auto p-4 bg-gray-50">
      {/* Dashboard Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Budget Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Budget</p>
                <h3 className="text-2xl font-semibold font-mono mt-1">{formatCurrency(totalBudget)}</h3>
              </div>
              <div className="bg-blue-50 p-2 rounded-md text-primary-600">
                <DollarSign className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">Spent:</span>
                <span className="font-medium font-mono">
                  {formatCurrency(totalActualCost)} ({formatPercent(totalActualCost / totalBudget * 100)})
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                <div 
                  className="bg-primary-600 h-2 rounded-full" 
                  style={{ width: `${Math.min(100, (totalActualCost / totalBudget) * 100)}%` }}
                ></div>
              </div>
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
                    <div key={item.id}>
                      <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center">
                          <span className="text-sm font-medium">{item.name}</span>
                          <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                            Level {item.level}
                          </span>
                        </div>
                        <div className="text-sm font-medium">{formatPercent(item.percentComplete)}</div>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div 
                          className={`h-2.5 rounded-full ${
                            Number(item.percentComplete) >= 100
                              ? "bg-green-600"
                              : Number(item.percentComplete) > 0
                              ? "bg-blue-600"
                              : "bg-gray-400"
                          }`}
                          style={{ width: `${item.percentComplete}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>
                          {formatCurrency(earnedValue)} / {formatCurrency(item.budgetedCost)}
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
            <div className="divide-y divide-gray-200">
              {wbsItems.length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  No activities found. Add WBS items to see upcoming activities.
                </div>
              ) : (
                wbsItems
                  .filter(item => item.type === "Activity" && Number(item.percentComplete) < 100)
                  .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
                  .slice(0, 4)
                  .map((item) => {
                    const today = new Date();
                    const startDate = new Date(item.startDate);
                    const daysUntilStart = Math.floor((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                    
                    let statusText = "";
                    let statusClass = "";
                    
                    if (daysUntilStart < 0) {
                      statusText = `Overdue by ${Math.abs(daysUntilStart)} days`;
                      statusClass = "bg-red-100 text-red-800";
                    } else if (daysUntilStart === 0) {
                      statusText = "Starting today";
                      statusClass = "bg-green-100 text-green-800";
                    } else if (daysUntilStart <= 7) {
                      statusText = `Starting in ${daysUntilStart} days`;
                      statusClass = "bg-amber-100 text-amber-800";
                    } else {
                      statusText = `Starting in ${daysUntilStart} days`;
                      statusClass = "bg-green-100 text-green-800";
                    }
                    
                    return (
                      <div key={item.id} className="py-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="text-sm font-medium">{item.name}</h4>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {wbsItems.find(wbs => wbs.id === item.parentId)?.name || ""}
                            </p>
                          </div>
                          <span className={`text-xs ${statusClass} px-2 py-0.5 rounded-full`}>
                            {statusText}
                          </span>
                        </div>
                        <div className="mt-2 flex justify-between text-xs">
                          <span className="text-gray-500">{item.duration} days duration</span>
                          <span className="font-medium">
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
      </div>
      
      {/* Simplified Gantt Chart */}
      <GanttChart projectId={projectId} />
    </div>
  );
}
