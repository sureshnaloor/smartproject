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
  const projectId = parseInt(params.projectId);
  const [reportType, setReportType] = useState<string>("overview");

  // Fetch project data
  const { data: project, isLoading: isLoadingProject } = useQuery<Project>({
    queryKey: [`/api/projects/${projectId}`],
  });

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
  const overallSPI = calculateSPI(totalEarned, totalBudget * 0.45); // Assuming 45% planned progress

  // Performance trend data (mock data - in a real app, this would come from historical snapshots)
  const performanceTrendData = [
    { date: "Jan 2023", cpi: 1.05, spi: 1.02 },
    { date: "Feb 2023", cpi: 1.03, spi: 1.01 },
    { date: "Mar 2023", cpi: 1.02, spi: 0.99 },
    { date: "Apr 2023", cpi: 1.04, spi: 0.98 },
    { date: "May 2023", cpi: 1.03, spi: 0.97 },
    { date: "Jun 2023", cpi: 1.02, spi: 0.96 },
    { date: "Jul 2023", cpi: overallCPI, spi: overallSPI },
  ];

  const isLoading = isLoadingProject || isLoadingWbs;

  if (isLoading) {
    return (
      <div className="p-4 space-y-6">
        <div className="flex justify-between items-center mb-4">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-10 w-60" />
        </div>
        <Skeleton className="h-[400px] w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-[300px] w-full" />
          <Skeleton className="h-[300px] w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-4 bg-gray-50 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Project Reports</h1>
          <p className="text-sm text-gray-500">
            Analysis and visualizations of project performance
          </p>
        </div>
        
        <div className="flex flex-wrap gap-3 items-center">
          <Select
            value={reportType}
            onValueChange={setReportType}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select report type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="overview">Project Overview</SelectItem>
              <SelectItem value="cost">Cost Analysis</SelectItem>
              <SelectItem value="schedule">Schedule Analysis</SelectItem>
              <SelectItem value="variance">Variance Analysis</SelectItem>
            </SelectContent>
          </Select>
          
          <Button variant="outline">
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
          
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Project Overview */}
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
                <div className="text-2xl font-semibold">{formatCurrency(totalActual)}</div>
                <div className="text-sm text-gray-600 mb-1">of {formatCurrency(totalBudget)}</div>
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
                Earned Value: {formatCurrency(totalEarned)}
              </div>
              <div className="text-sm text-gray-500">
                Actual Cost: {formatCurrency(totalActual)}
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
                Earned Value: {formatCurrency(totalEarned)}
              </div>
              <div className="text-sm text-gray-500">
                Planned Value: {formatCurrency(totalBudget * 0.45)}
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
                <Tooltip formatter={(value) => formatCurrency(value)} />
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
        {/* Performance Trend Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Performance Indices Trend</CardTitle>
            <CardDescription>
              CPI and SPI trends over time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart
                data={performanceTrendData}
                margin={{
                  top: 5,
                  right: 30,
                  left: 20,
                  bottom: 5,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis domain={[0.8, 1.2]} />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="cpi" 
                  name="CPI" 
                  stroke="#8884d8" 
                  activeDot={{ r: 8 }} 
                />
                <Line 
                  type="monotone" 
                  dataKey="spi" 
                  name="SPI" 
                  stroke="#82ca9d" 
                />
                {/* Reference line at 1.0 */}
                <Line 
                  dataKey={() => 1} 
                  stroke="#ff7300" 
                  strokeDasharray="3 3" 
                  name="Target (1.0)" 
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Budget Allocation Pie Chart */}
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
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
