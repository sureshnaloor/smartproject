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
import { Printer, Download, Share2, BarChart3, FileText, ChevronDown } from "lucide-react";
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
import { motion } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
    <div className="flex-1 overflow-auto">
      {/* Header section with purple/indigo gradient */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-100 border-b border-indigo-200">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col md:flex-row md:items-center md:justify-between"
          >
            <div className="mb-4 md:mb-0">
              <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                <BarChart3 className="mr-2 h-6 w-6 text-indigo-600" />
                {project?.name} Reports
              </h1>
              <p className="text-gray-600 mt-1">
                Comprehensive project performance analysis and visualization
              </p>
            </div>
            <div className="flex flex-wrap gap-3 items-center">
              <Select
                value={reportType}
                onValueChange={setReportType}
              >
                <SelectTrigger className="w-[180px] bg-white border-indigo-200">
                  <SelectValue placeholder="Report Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="overview">Performance Overview</SelectItem>
                  <SelectItem value="budget">Budget Analysis</SelectItem>
                  <SelectItem value="schedule">Schedule Analysis</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Button variant="outline" size="icon" className="bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-50">
                  <Printer className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-50">
                  <Download className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-50">
                  <Share2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Content section */}
      <div className="bg-gray-50 min-h-[calc(100vh-120px)]">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <Tabs defaultValue="performance" className="w-full">
            <TabsList className="mb-6 bg-white border border-gray-200">
              <TabsTrigger value="performance" className="data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700">
                Performance Metrics
              </TabsTrigger>
              <TabsTrigger value="cost" className="data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700">
                Cost Analysis
              </TabsTrigger>
              <TabsTrigger value="schedule" className="data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700">
                Schedule Analysis
              </TabsTrigger>
            </TabsList>

            <TabsContent value="performance">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="space-y-6"
              >
                <Card className="border-indigo-200 shadow-sm">
                  <CardHeader className="bg-white border-b border-indigo-100">
                    <CardTitle className="text-lg font-medium text-gray-900">Project Performance Summary</CardTitle>
                    <CardDescription className="text-gray-500">
                      Key performance metrics for {project?.name}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                      <div className="bg-white rounded-lg p-4 border border-indigo-100 shadow-sm">
                        <div className="text-sm text-gray-500 mb-1">Budget vs Actual</div>
                        <div className="flex items-end gap-2">
                          <div className="text-2xl font-semibold">{formatCurrency(totalActual, projectCurrency)}</div>
                          <div className="text-sm text-gray-600 mb-1">of {formatCurrency(totalBudget, projectCurrency)}</div>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                          <div 
                            className="bg-indigo-600 h-2 rounded-full" 
                            style={{ width: `${Math.min(100, (totalActual / totalBudget) * 100)}%` }}
                          ></div>
                        </div>
                        <div className="text-sm text-gray-500 mt-1">
                          {formatPercent((totalActual / totalBudget) * 100)} of budget used
                        </div>
                      </div>
                      
                      <div className="bg-white rounded-lg p-4 border border-indigo-100 shadow-sm">
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
                      
                      <div className="bg-white rounded-lg p-4 border border-indigo-100 shadow-sm">
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
                      <h3 className="text-base font-medium mb-4 text-gray-800">Cost & Schedule Performance by WBS</h3>
                      <div className="bg-white p-4 rounded-lg border border-indigo-100 shadow-sm">
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
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
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
                    </div>
                  </CardContent>
                </Card>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="border-indigo-200 shadow-sm">
                    <CardHeader className="bg-white border-b border-indigo-100">
                      <CardTitle className="text-lg font-medium text-gray-900">Schedule Progress</CardTitle>
                      <CardDescription className="text-gray-500">
                        Planned vs Actual progress over time
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <div className="bg-white p-4 rounded-lg border border-indigo-100">
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
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip formatter={currencyTooltipFormatter} />
                            <Legend />
                            <Line type="monotone" dataKey="budget" name="Planned Value" stroke="#8884d8" strokeWidth={2} />
                            <Line type="monotone" dataKey="earned" name="Earned Value" stroke="#82ca9d" strokeWidth={2} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="border-indigo-200 shadow-sm">
                    <CardHeader className="bg-white border-b border-indigo-100">
                      <CardTitle className="text-lg font-medium text-gray-900">Budget Distribution</CardTitle>
                      <CardDescription className="text-gray-500">
                        Budget allocation across top-level WBS items
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <div className="bg-white p-4 rounded-lg border border-indigo-100">
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
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </motion.div>
            </TabsContent>

            <TabsContent value="cost">
              <div className="text-center p-8 border border-dashed border-indigo-300 rounded-lg bg-white">
                <FileText className="mx-auto h-12 w-12 text-indigo-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Cost Analysis Report</h3>
                <p className="text-gray-500 mb-4">Detailed cost breakdowns and variance analysis</p>
                <Button className="bg-indigo-600 hover:bg-indigo-700">Generate Report</Button>
              </div>
            </TabsContent>

            <TabsContent value="schedule">
              <div className="text-center p-8 border border-dashed border-indigo-300 rounded-lg bg-white">
                <FileText className="mx-auto h-12 w-12 text-indigo-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Schedule Analysis Report</h3>
                <p className="text-gray-500 mb-4">Critical path analysis and timeline visualization</p>
                <Button className="bg-indigo-600 hover:bg-indigo-700">Generate Report</Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
