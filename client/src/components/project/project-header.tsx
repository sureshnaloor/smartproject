import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Project, WbsItem } from "@shared/schema";
import { formatCurrency, formatDate, getStatusColor } from "@/lib/utils";
import { FileSpreadsheet, ChartLine, GanttChart, Menu, MoreHorizontal, BarChart2, PencilIcon, ArrowLeft, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImportWbsModal } from "./import-wbs-modal";
import { DeleteProjectDialog } from "./delete-project-dialog";
import { EditProjectModal } from "./edit-project-modal";
import { useMobile } from "@/hooks/use-mobile";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ProjectHeaderProps {
  projectId: number;
  onToggleSidebar?: () => void;
  onClose?: () => void;
}

export function ProjectHeader({ projectId, onToggleSidebar, onClose }: ProjectHeaderProps) {
  const [location, setLocation] = useLocation();
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
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

  // Handle successful project deletion
  const handleProjectDeleted = () => {
    setLocation("/");
  };

  return (
    <div className="bg-white border-b border-gray-200">
      {/* Project Basic Information */}
      <div className="px-4 py-4 sm:px-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center">
              {onClose && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={onClose} 
                  className="mr-2 text-gray-500 hover:text-gray-700"
                >
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  <span className="sr-only md:not-sr-only md:inline-block">Back to Projects</span>
                </Button>
              )}
              <h2 className="text-xl font-semibold text-gray-900 mr-2">
                {project.name}
              </h2>
              <Button 
                variant="outline" 
                size="icon" 
                className="h-7 w-7"
                onClick={() => setIsEditModalOpen(true)}
              >
                <PencilIcon className="h-3.5 w-3.5" />
                <span className="sr-only">Edit</span>
              </Button>
            </div>
            <div className="mt-1 flex flex-wrap items-center text-sm text-gray-500">
              <span className="mr-6">
                <strong>Budget:</strong> {formatCurrency(project.budget, project.currency || "USD")}
              </span>
              <span className="mr-6">
                <strong>Timeline:</strong> {formatDate(project.startDate)} - {formatDate(project.endDate)}
              </span>
              <span className={`mr-6 flex items-center font-medium ${status.textColor}`}>
                <span 
                  className={`w-2 h-2 mr-1 rounded-full ${status.color}`}
                ></span>
                {status.status}
              </span>
            </div>
          </div>
          <div className="flex space-x-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setIsImportModalOpen(true)}
            >
              Import WBS
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">More options</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Project Actions</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setIsEditModalOpen(true)}>
                  Edit project details
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Export as PDF</DropdownMenuItem>
                <DropdownMenuItem>Export as Excel</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-red-500 focus:text-red-500"
                  onSelect={(e) => e.preventDefault()}
                >
                  <DeleteProjectDialog
                    projectId={project.id}
                    projectName={project.name}
                    onSuccess={handleProjectDeleted}
                    trigger={<div className="flex items-center w-full">Delete project</div>}
                  />
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-6 px-4 sm:px-6 overflow-x-auto">
          <Link href={`/projects/${projectId}`}>
            <a
              className={`whitespace-nowrap border-b-2 py-3 px-1 text-sm font-medium ${
                location === `/projects/${projectId}`
                  ? "border-primary-500 text-primary-600"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              Dashboard
            </a>
          </Link>
          <Link href={`/projects/${projectId}/wbs`}>
            <a
              className={`whitespace-nowrap border-b-2 py-3 px-1 text-sm font-medium ${
                location === `/projects/${projectId}/wbs`
                  ? "border-primary-500 text-primary-600"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              Work Breakdown
            </a>
          </Link>
          <Link href={`/projects/${projectId}/schedule`}>
            <a
              className={`whitespace-nowrap border-b-2 py-3 px-1 text-sm font-medium ${
                location === `/projects/${projectId}/schedule`
                  ? "border-primary-500 text-primary-600"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              <GanttChart className="inline-block h-4 w-4 mr-1" />
              Schedule
            </a>
          </Link>
          <Link href={`/projects/${projectId}/costs`}>
            <a
              className={`whitespace-nowrap border-b-2 py-3 px-1 text-sm font-medium ${
                location === `/projects/${projectId}/costs`
                  ? "border-primary-500 text-primary-600"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              <DollarSign className="inline-block h-4 w-4 mr-1" />
              Cost Control
            </a>
          </Link>
          <Link href={`/projects/${projectId}/reports`}>
            <a
              className={`whitespace-nowrap border-b-2 py-3 px-1 text-sm font-medium ${
                location === `/projects/${projectId}/reports`
                  ? "border-primary-500 text-primary-600"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              <FileSpreadsheet className="inline-block h-4 w-4 mr-1" />
              Reports
            </a>
          </Link>
        </nav>
      </div>

      {/* Import WBS Modal */}
      <ImportWbsModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        projectId={project.id}
      />

      {/* Edit Project Modal */}
      <EditProjectModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        projectId={project.id}
      />
    </div>
  );
}
