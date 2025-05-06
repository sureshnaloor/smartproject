import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Project } from "@shared/types";
import { formatCurrency, formatDate, formatPercent, calculateEarnedValue, calculateCPI, calculateSPI, getProjectProgress, getProjectBudget } from "@/lib/utils";
import { 
  Building, 
  Clock, 
  DollarSign, 
  ArrowRight, 
  Plus, 
  MoreHorizontal,
  BarChart2,
  GanttChart,
  FileSpreadsheet,
  ChartLine,
  LucideLayers,
  CheckCircle2,
  Bell,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddProjectModal } from "@/components/project/add-project-modal";
import { DeleteProjectDialog } from "@/components/project/delete-project-dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Footer } from "@/components/ui/footer";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Progress } from "@/components/ui/progress";

export default function Home() {
  const [location, setLocation] = useLocation();
  const [isAddProjectModalOpen, setIsAddProjectModalOpen] = useState(false);

  // Fetch all projects
  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
  });

  // Navigate to project page
  const handleProjectClick = (projectId: number) => {
    setLocation(`/projects/${projectId}`);
  };

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-stone-50">
      {/* Header - Matching Project Layout Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 h-16 flex-shrink-0">
        <div className="flex justify-between items-center px-4 py-2 h-full max-w-7xl mx-auto">
          <div className="flex items-center">
            <div className="mr-2 cursor-pointer" onClick={() => setLocation('/')}>
              <img src="/smartproject.png" alt="ConstructPro Logo" className="h-8 w-auto" />
            </div>
            <h1 className="text-xl font-semibold text-gray-800 cursor-pointer" onClick={() => setLocation('/')}>ConstructPro</h1>
          </div>
          <div className="flex items-center space-x-4">
            <button className="text-gray-500 hover:text-gray-700 transition-colors duration-200">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3Z"></path>
                <path d="M8 17v1a4 4 0 0 0 8 0v-1"></path>
                <path d="M17 9v1"></path>
                <path d="M19.4 7.4L19.4 7.4"></path>
                <path d="M7 9v1"></path>
                <path d="M4.6 7.4L4.6 7.4"></path>
              </svg>
            </button>
            <button className="text-gray-500 hover:text-gray-700 transition-colors duration-200">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            </button>
            <div className="relative">
              <button className="flex items-center focus:outline-none group">
                <div className="w-8 h-8 rounded-full bg-teal-600 flex items-center justify-center text-white transition-transform duration-300 group-hover:scale-110">
                  <span className="text-sm">JD</span>
                </div>
                <span className="ml-2 text-sm font-medium hidden md:block group-hover:text-teal-700 transition-colors duration-200">John Doe</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1">
        {/* Hero Section - Teal Gradient */}
        <div className="bg-gradient-to-br from-teal-50 to-teal-100 border-b border-teal-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <motion.div 
              className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center"
              initial="hidden"
              animate="visible"
              variants={containerVariants}
            >
              {/* Hero Content */}
              <motion.div variants={itemVariants}>
                <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
                  Construction Project Management Made Simple
                </h2>
                <p className="text-lg text-gray-700 mb-8">
                  Streamline your construction projects with powerful cost control, 
                  scheduling, and performance monitoring tools.
                </p>
                <div className="flex flex-wrap gap-4">
                  <Button 
                    size="lg" 
                    onClick={() => setIsAddProjectModalOpen(true)}
                    className="bg-teal-600 hover:bg-teal-700 transition-all duration-300 hover:shadow-lg transform hover:-translate-y-1"
                  >
                    <Plus className="mr-2 h-5 w-5" />
                    Start New Project
                  </Button>
                  <Button 
                    variant="outline" 
                    size="lg"
                    className="border-teal-600 text-teal-700 hover:bg-teal-50 transition-all duration-300"
                  >
                    <ChartLine className="mr-2 h-5 w-5" />
                    View Demo
                  </Button>
                </div>
              </motion.div>
              
              {/* Feature Cards */}
              <div className="grid grid-cols-2 gap-4">
                <motion.div 
                  className="bg-white p-5 rounded-lg shadow-sm border border-gray-200 hover:shadow-md hover:border-teal-200 transition-all duration-300 transform hover:-translate-y-1"
                  variants={itemVariants}
                >
                  <GanttChart className="h-8 w-8 text-teal-600 mb-3" />
                  <h3 className="font-semibold text-gray-900 mb-1">Schedule Tracking</h3>
                  <p className="text-gray-600 text-sm">Monitor your project timeline with Gantt charts</p>
                </motion.div>
                <motion.div 
                  className="bg-white p-5 rounded-lg shadow-sm border border-gray-200 hover:shadow-md hover:border-teal-200 transition-all duration-300 transform hover:-translate-y-1"
                  variants={itemVariants}
                >
                  <DollarSign className="h-8 w-8 text-teal-600 mb-3" />
                  <h3 className="font-semibold text-gray-900 mb-1">Cost Control</h3>
                  <p className="text-gray-600 text-sm">Track budgets, actual costs and variances</p>
                </motion.div>
                <motion.div 
                  className="bg-white p-5 rounded-lg shadow-sm border border-gray-200 hover:shadow-md hover:border-teal-200 transition-all duration-300 transform hover:-translate-y-1"
                  variants={itemVariants}
                >
                  <LucideLayers className="h-8 w-8 text-teal-600 mb-3" />
                  <h3 className="font-semibold text-gray-900 mb-1">WBS Management</h3>
                  <p className="text-gray-600 text-sm">Organize work in hierarchical structures</p>
                </motion.div>
                <motion.div 
                  className="bg-white p-5 rounded-lg shadow-sm border border-gray-200 hover:shadow-md hover:border-teal-200 transition-all duration-300 transform hover:-translate-y-1"
                  variants={itemVariants}
                >
                  <BarChart2 className="h-8 w-8 text-teal-600 mb-3" />
                  <h3 className="font-semibold text-gray-900 mb-1">Performance Analysis</h3>
                  <p className="text-gray-600 text-sm">Calculate earned value, CPI and SPI metrics</p>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
        
        {/* How It Works Section - Stone Background */}
        <div className="bg-stone-100 border-b border-stone-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <motion.h2 
              className="text-2xl font-bold text-center text-gray-900 mb-12"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              How ConstructPro Works
            </motion.h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              <motion.div 
                className="text-center"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.1 }}
              >
                <div className="bg-teal-50 rounded-full h-16 w-16 flex items-center justify-center mx-auto mb-4 border border-teal-100 shadow-sm transform hover:scale-110 transition-transform duration-300">
                  <Plus className="h-8 w-8 text-teal-600" />
                </div>
                <h3 className="font-semibold mb-2">1. Create Project</h3>
                <p className="text-gray-600 text-sm">
                  Set up your project with basic details, budget and timeline
                </p>
              </motion.div>
              <motion.div 
                className="text-center"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <div className="bg-teal-50 rounded-full h-16 w-16 flex items-center justify-center mx-auto mb-4 border border-teal-100 shadow-sm transform hover:scale-110 transition-transform duration-300">
                  <LucideLayers className="h-8 w-8 text-teal-600" />
                </div>
                <h3 className="font-semibold mb-2">2. Define WBS</h3>
                <p className="text-gray-600 text-sm">
                  Break down project into manageable work packages
                </p>
              </motion.div>
              <motion.div 
                className="text-center"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                <div className="bg-teal-50 rounded-full h-16 w-16 flex items-center justify-center mx-auto mb-4 border border-teal-100 shadow-sm transform hover:scale-110 transition-transform duration-300">
                  <GanttChart className="h-8 w-8 text-teal-600" />
                </div>
                <h3 className="font-semibold mb-2">3. Schedule Work</h3>
                <p className="text-gray-600 text-sm">
                  Assign timelines and dependencies to activities
                </p>
              </motion.div>
              <motion.div 
                className="text-center"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.4 }}
              >
                <div className="bg-teal-50 rounded-full h-16 w-16 flex items-center justify-center mx-auto mb-4 border border-teal-100 shadow-sm transform hover:scale-110 transition-transform duration-300">
                  <CheckCircle2 className="h-8 w-8 text-teal-600" />
                </div>
                <h3 className="font-semibold mb-2">4. Track Progress</h3>
                <p className="text-gray-600 text-sm">
                  Update completion status and monitor performance
                </p>
              </motion.div>
            </div>
          </div>
        </div>
        
        {/* Projects List - Light Gray Background */}
        <div className="bg-gray-50 py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div 
              className="flex justify-between items-center mb-8"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Your Projects</h2>
                <p className="text-gray-500">
                  Manage your existing construction projects or create new ones
                </p>
              </div>
              <Button 
                onClick={() => setIsAddProjectModalOpen(true)}
                className="bg-teal-600 hover:bg-teal-700 transition-all duration-300 hover:shadow-lg transform hover:-translate-y-1"
              >
                <Plus className="mr-2 h-4 w-4" />
                New Project
              </Button>
            </motion.div>

            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="overflow-hidden">
                    <CardHeader className="pb-3">
                      <Skeleton className="h-5 w-3/4 mb-2" />
                      <Skeleton className="h-4 w-1/2" />
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                      </div>
                    </CardContent>
                    <CardFooter>
                      <Skeleton className="h-10 w-full" />
                    </CardFooter>
                  </Card>
                ))}
              </div>
            ) : projects.length === 0 ? (
              <motion.div 
                className="text-center py-16 bg-white rounded-lg border border-gray-200 shadow-sm"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
              >
                <Building className="mx-auto h-12 w-12 text-teal-400" />
                <h3 className="mt-2 text-sm font-semibold text-gray-900">No projects yet</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Get started by creating your first construction project
                </p>
                <div className="mt-6">
                  <Button 
                    onClick={() => setIsAddProjectModalOpen(true)}
                    className="bg-teal-600 hover:bg-teal-700 transition-all duration-300 hover:shadow-lg"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Create Project
                  </Button>
                </div>
              </motion.div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {projects.map((project, index) => (
                  <motion.div
                    key={project.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: index * 0.1 }}
                  >
                    <Card className="overflow-hidden hover:shadow-md transition-all duration-300 hover:border-teal-200 transform hover:-translate-y-1 bg-white">
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle>{project.name}</CardTitle>
                            <CardDescription>
                              {project.description || "No description provided"}
                            </CardDescription>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-teal-50 transition-colors duration-200">
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Open menu</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                className="text-red-500 focus:text-red-500"
                                onSelect={(e) => e.preventDefault()}
                              >
                                <DeleteProjectDialog
                                  projectId={project.id}
                                  projectName={project.name}
                                  trigger={<div className="flex items-center w-full">Delete project</div>}
                                />
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="flex items-center text-sm">
                            <DollarSign className="mr-2 h-4 w-4 text-teal-500" />
                            <span className="text-gray-700 font-medium">{formatCurrency(project.budget, project.currency || "USD")}</span>
                          </div>
                          <div className="flex items-center text-sm">
                            <Clock className="mr-2 h-4 w-4 text-teal-500" />
                            <span className="text-gray-700">
                              {formatDate(project.startDate)} - {formatDate(project.endDate)}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Progress</p>
                            <Progress value={getProjectProgress(project, project.wbsItems || [])} className="mt-2" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Budget</p>
                            <p className="font-medium">
                              {formatCurrency(getProjectBudget(project, project.wbsItems || []).spent, project.currency)} /{" "}
                              {formatCurrency(getProjectBudget(project, project.wbsItems || []).total, project.currency)}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                      <CardFooter>
                        <Button 
                          className="w-full bg-teal-600 hover:bg-teal-700 transition-all duration-300" 
                          onClick={() => handleProjectClick(project.id)}
                        >
                          Open Project
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </CardFooter>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer Component */}
      <Footer />

      <AddProjectModal
        isOpen={isAddProjectModalOpen}
        onClose={() => setIsAddProjectModalOpen(false)}
        onSuccess={(projectId) => {
          setIsAddProjectModalOpen(false);
          // Navigate to the project page after creation
          setLocation(`/projects/${projectId}`);
        }}
      />
    </div>
  );
}
