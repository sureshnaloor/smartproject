import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Project, WbsItem } from "@shared/schema";
import { formatCurrency, formatDate, getStatusColor } from "@/lib/utils";
import { FileSpreadsheet, ChartLine, GanttChart, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImportCostsModal } from "./import-costs-modal";
import { useMobile } from "@/hooks/use-mobile";

interface ProjectHeaderProps {
  projectId: number;
  onToggleSidebar?: () => void;
}

export function ProjectHeader({ projectId, onToggleSidebar }: ProjectHeaderProps) {
  const [location] = useLocation();
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const isMobile = useMobile();

  // Fetch project data
  const { data: project, isLoading: isLoadingProject } = useQuery<Project>({
    queryKey: [`/api/projects/${projectId}`],
  });

  // Fetch WBS items to calculate status
  const { data: wbsItems = [] } = useQuery<WbsItem[]>({
    queryKey: [`/api/projects/${projectId}/wbs`],
  });

  if (isLoadingProject) {
    return (
      <div className="bg-white border-b border-gray-200 animate-pulse">
        <div className="px-4 py-4 sm:px-6">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
        <div className="border-b border-gray-200">
          <div className="h-10 px-4 bg-gray-50"></div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="bg-white border-b border-gray-200">
        <div className="px-4 py-4 sm:px-6">
          <div className="text-red-500">Project not found</div>
        </div>
      </div>
    );
  }

  // Calculate overall progress
  const totalBudget = wbsItems.reduce((sum, item) => sum + Number(item.budgetedCost), 0);
  const completedValue = wbsItems.reduce((sum, item) => sum + (Number(item.budgetedCost) * Number(item.percentComplete) / 100), 0);
  const overallProgress = totalBudget > 0 ? (completedValue / totalBudget) * 100 : 0;
  const expectedProgress = 45; // This would normally be calculated based on current date vs. schedule

  // Get status color
  const status = getStatusColor(expectedProgress, overallProgress);

  return (
    <div className="bg-white border-b border-gray-200">
      <div className="px-4 py-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between">
        <div className="flex items-center">
          {isMobile && (
            <button 
              onClick={onToggleSidebar}
              className="mr-2 text-gray-500 hover:text-gray-700 md:hidden"
            >
              <Menu size={20} />
            </button>
          )}
          <div>
            <h1 className="text-lg font-semibold text-gray-900">{project.name}</h1>
            <div className="mt-1 flex flex-wrap items-center text-sm text-gray-500">
              <span className="font-medium text-primary-600">{formatCurrency(project.budget)}</span>
              <span className="mx-2">•</span>
              <span>{formatDate(project.startDate)} - {formatDate(project.endDate)}</span>
              <span className="mx-2">•</span>
              <span className="flex items-center">
                <span className={`h-2 w-2 rounded-full ${status.color} mr-1`}></span>
                <span className={status.textColor}>{status.status}</span>
              </span>
            </div>
          </div>
        </div>
        <div className="mt-4 sm:mt-0 flex gap-2 flex-wrap">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setIsImportModalOpen(true)}
          >
            <FileSpreadsheet className="mr-1.5 h-4 w-4" />
            Import Data
          </Button>
          <Button size="sm">
            <ChartLine className="mr-1.5 h-4 w-4" />
            Generate Report
          </Button>
        </div>
      </div>
      
      {/* Navigation Tabs */}
      <div className="border-b border-gray-200 overflow-x-auto">
        <nav className="flex -mb-px">
          <Link href={`/projects/${projectId}`}>
            <a className={`whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm ${
              location === `/projects/${projectId}` 
                ? "border-primary-500 text-primary-600" 
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}>
              Dashboard
            </a>
          </Link>
          <Link href={`/projects/${projectId}/wbs`}>
            <a className={`whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm ${
              location === `/projects/${projectId}/wbs` 
                ? "border-primary-500 text-primary-600" 
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}>
              WBS Structure
            </a>
          </Link>
          <Link href={`/projects/${projectId}/schedule`}>
            <a className={`whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm ${
              location === `/projects/${projectId}/schedule` 
                ? "border-primary-500 text-primary-600" 
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}>
              Schedule
            </a>
          </Link>
          <Link href={`/projects/${projectId}/costs`}>
            <a className={`whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm ${
              location === `/projects/${projectId}/costs` 
                ? "border-primary-500 text-primary-600" 
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}>
              Cost Control
            </a>
          </Link>
          <Link href={`/projects/${projectId}/reports`}>
            <a className={`whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm ${
              location === `/projects/${projectId}/reports` 
                ? "border-primary-500 text-primary-600" 
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}>
              Reports
            </a>
          </Link>
        </nav>
      </div>

      <ImportCostsModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        projectId={projectId}
      />
    </div>
  );
}
