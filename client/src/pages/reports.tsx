import { useParams } from "wouter";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Project, WbsItem } from "@shared/schema";
import { 
  formatCurrency, 
  formatDate, 
  formatPercent, 
  calculateEarnedValue, 
  calculateCPI, 
  calculateSPI 
} from "@/lib/utils";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Printer, Download, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { Skeleton } from "@/components/ui/skeleton";

export default function Reports() {
  const params = useParams();
  const projectId = params.projectId ? parseInt(params.projectId) : 0;
  const [reportType, setReportType] = useState<string>("overview");

  // Fetch project data
  const { data: project, isLoading: isLoadingProject } = useQuery<Project>({
    queryKey: [`/api/projects/${projectId}`],
  });

  // Get the project currency or default to USD if not available
  const projectCurrency = project?.currency || "USD";

  // Fetch WBS items for the project
  const { data: wbsItems = [], isLoading: isLoadingWbs } = useQuery<WbsItem[]>({
    queryKey: [`/api/projects/${projectId}/wbs`],
  });

  // Generate data for charts
  const wbsChartData = wbsItems
    .filter(item => item.level === 1)
    .map(item => ({
      name: item.name,
      budget: Number(item.budgetedCost),
      actual: Number(item.actualCost),
      earned: calculateEarnedValue(Number(item.budgetedCost), Number(item.percentComplete)),
      progress: Number(item.percentComplete),
    }));

  const pieSeries = [
    {
      name: "Budget Allocation",
      data: wbsItems
        .filter(item => item.level === 1)
        .map(item => ({
          name: item.name,
          value: Number(item.budgetedCost),
        })),
    },
    {
      name: "Actual Cost Distribution",
      data: wbsItems
        .filter(item => item.level === 1)
        .map(item => ({
          name: item.name,
          value: Number(item.actualCost),
        })),
    },
  ];

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

  // Calculate overall metrics
  const totalBudget = wbsItems.reduce((sum, item) => sum + Number(item.budgetedCost), 0);
  const totalActual = wbsItems.reduce((sum, item) => sum + Number(item.actualCost), 0);
  const totalEarned = wbsItems.reduce(
    (sum, item) => sum + calculateEarnedValue(Number(item.budgetedCost), Number(item.percentComplete)),
    0
  );
  
  const overallCPI = calculateCPI(totalEarned, totalActual);
  const overallSPI = calculateSPI(totalEarned, totalBudget * 0.45);
  
  const isLoading = isLoadingProject || isLoadingWbs;
  
  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-8 w-[300px]" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-[150px]" />
          <Skeleton className="h-[150px]" />
          <Skeleton className="h-[150px]" />
        </div>
        <Skeleton className="h-[300px]" />
      </div>
    );
  }

  // Custom tooltip formatter that uses the project currency
  const currencyTooltipFormatter = (value: number) => formatCurrency(value, projectCurrency || "USD");

  return (
    <div className="flex-1 overflow-auto p-4 bg-gray-50">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">{project?.name} Reports</h1>
        <div className="flex gap-2">
          <Select
            value={reportType}
            onValueChange={setReportType}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Report Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="overview">Performance Overview</SelectItem>
              <SelectItem value="budget">Budget Analysis</SelectItem>
              <SelectItem value="schedule">Schedule Analysis</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon">
            <Printer className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon">
            <Download className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon">
            <Share2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Project Performance Summary</CardTitle>
          <CardDescription>
            Key performance metrics for {project?.name}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="text-sm text-gray-500 mb-1">Budget vs Actual</div>
              <div className="flex items-end gap-2">
                <div className="text-2xl font-semibold">{formatCurrency(totalActual, projectCurrency)}</div>
                <div className="text-sm text-gray-600 mb-1">of {formatCurrency(totalBudget, projectCurrency)}</div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full" 
                  style={{ width: `${Math.min(100, (totalActual / totalBudget) * 100)}%` }}
                ></div>
              </div>
              <div className="text-sm text-gray-500 mt-1">
                {formatPercent((totalActual / totalBudget) * 100)} of budget used
              </div>
            </div>
            
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="text-sm text-gray-500 mb-1">Cost Performance Index (CPI)</div>
              <div className="flex items-end gap-2">
                <div className="text-2xl font-semibold">{overallCPI.toFixed(2)}</div>
                <div className={`text-sm mb-1 ${
                  overallCPI >= 1 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {overallCPI >= 1 ? 'Under budget' : 'Over budget'}
                </div>
              </div>
              <div className="text-sm text-gray-500 mt-2">
                Earned Value: {formatCurrency(totalEarned, projectCurrency)}
              </div>
              <div className="text-sm text-gray-500">
                Actual Cost: {formatCurrency(totalActual, projectCurrency)}
              </div>
            </div>
            
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="text-sm text-gray-500 mb-1">Schedule Performance Index (SPI)</div>
              <div className="flex items-end gap-2">
                <div className="text-2xl font-semibold">{overallSPI.toFixed(2)}</div>
                <div className={`text-sm mb-1 ${
                  overallSPI >= 1 ? 'text-green-600' : 'text-amber-600'
                }`}>
                  {overallSPI >= 1 ? 'Ahead of schedule' : 'Behind schedule'}
                </div>
              </div>
              <div className="text-sm text-gray-500 mt-2">
                Earned Value: {formatCurrency(totalEarned, projectCurrency)}
              </div>
              <div className="text-sm text-gray-500">
                Planned Value: {formatCurrency(totalBudget * 0.45, projectCurrency)}
              </div>
            </div>
          </div>
          
          <div className="mt-6">
            <h3 className="text-base font-medium mb-4">Cost & Schedule Performance by WBS</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={wbsChartData}
                margin={{
                  top: 20,
                  right: 30,
                  left: 20,
                  bottom: 5,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={currencyTooltipFormatter} />
                <Legend />
                <Bar dataKey="budget" name="Budget" fill="#8884d8" />
                <Bar dataKey="actual" name="Actual Cost" fill="#82ca9d" />
                <Bar dataKey="earned" name="Earned Value" fill="#ffc658" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Schedule Progress</CardTitle>
            <CardDescription>
              Planned vs Actual progress over time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart
                data={wbsChartData}
                margin={{
                  top: 5,
                  right: 30,
                  left: 20,
                  bottom: 5,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={currencyTooltipFormatter} />
                <Legend />
                <Line type="monotone" dataKey="budget" name="Planned Value" stroke="#8884d8" />
                <Line type="monotone" dataKey="earned" name="Earned Value" stroke="#82ca9d" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Budget Distribution</CardTitle>
            <CardDescription>
              Budget allocation across top-level WBS items
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieSeries[0].data}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  nameKey="name"
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                >
                  {pieSeries[0].data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={currencyTooltipFormatter} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
