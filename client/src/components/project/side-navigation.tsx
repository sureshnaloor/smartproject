import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Project } from "@shared/schema";
import { cn } from "@/lib/utils";
import { 
  Building,
  Building2,
  BringToFront,
  Settings,
  Download,
  Plus,
  Activity,
  ListTodo,
  Users,
  PieChart,
  FileText
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useMobile } from "@/hooks/use-mobile";
import { AddProjectModal } from "./add-project-modal";

interface SideNavigationProps {
  currentProjectId?: number;
}

export function SideNavigation({ currentProjectId }: SideNavigationProps) {
  const [location, setLocation] = useLocation();
  const [isAddProjectModalOpen, setIsAddProjectModalOpen] = useState(false);
  const isMobile = useMobile();
  const [isOpen, setIsOpen] = useState(!isMobile);

  // Toggle sidebar when mobile state changes
  useEffect(() => {
    setIsOpen(!isMobile);
  }, [isMobile]);

  // Fetch all projects
  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
  });

  // Get the current project
  const currentProject = projects.find(project => project.id === currentProjectId);

  // Check if a path is active
  const isActive = (path: string) => {
    return location.includes(path);
  };

  if (isMobile && !isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed top-16 left-0 z-20 p-2 bg-white rounded-r-md shadow-md text-gray-600"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="menu">
          <line x1="4" x2="20" y1="12" y2="12"/>
          <line x1="4" x2="20" y1="6" y2="6"/>
          <line x1="4" x2="20" y1="18" y2="18"/>
        </svg>
      </button>
    );
  }

  return (
    <>
      <aside className={cn(
        "bg-white border-r border-gray-200 flex-shrink-0 transition-all duration-300 h-[calc(100vh-4rem)] fixed md:relative top-16 md:top-0 z-30",
        isOpen ? "w-64 left-0" : "-left-full md:left-0 md:w-0"
      )}>
        <div className="h-full flex flex-col">
          <div className="px-4 py-3 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-600">PROJECTS</h2>
              <button 
                className="text-primary-600 hover:text-primary-800"
                onClick={() => setIsAddProjectModalOpen(true)}
              >
                <Plus size={16} />
              </button>
              
              {isMobile && (
                <button
                  className="ml-2 text-gray-500 hover:text-gray-700"
                  onClick={() => setIsOpen(false)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="x">
                    <path d="M18 6 6 18"/>
                    <path d="m6 6 12 12"/>
                  </svg>
                </button>
              )}
            </div>
          </div>
          
          <div className="overflow-y-auto flex-1">
            {isLoading ? (
              <div className="flex justify-center p-4">
                <svg className="animate-spin h-5 w-5 text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
            ) : (
              <>
                <ul className="py-2">
                  {projects.map((project) => (
                    <li key={project.id}>
                      <Link href={`/projects/${project.id}`}>
                        <a className={cn(
                          "flex items-center px-4 py-2 text-gray-600 hover:bg-gray-50",
                          currentProjectId === project.id && "text-primary-600 font-medium bg-primary-50"
                        )}>
                          {currentProjectId === project.id ? (
                            <Building2 className="mr-3 h-5 w-5" />
                          ) : (
                            <Building className="mr-3 h-5 w-5" />
                          )}
                          <span className="truncate">{project.name}</span>
                        </a>
                      </Link>
                    </li>
                  ))}
                </ul>

                {currentProjectId && (
                  <>
                    <div className="px-4 py-2 border-t border-gray-200">
                      <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Project Tools
                      </h2>
                    </div>
                    <ul className="py-1">
                      <li>
                        <Link href={`/under-construction/Activity-Master`}>
                          <a className={cn(
                            "flex items-center px-4 py-2 text-gray-600 hover:bg-gray-50",
                            isActive('/under-construction/Activity-Master') && "text-teal-600 font-medium bg-teal-50"
                          )}>
                            <Activity className="mr-3 h-5 w-5" />
                            <span>Activity Master</span>
                          </a>
                        </Link>
                      </li>
                      <li>
                        <Link href={`/under-construction/Task-Master`}>
                          <a className={cn(
                            "flex items-center px-4 py-2 text-gray-600 hover:bg-gray-50",
                            isActive('/under-construction/Task-Master') && "text-teal-600 font-medium bg-teal-50"
                          )}>
                            <ListTodo className="mr-3 h-5 w-5" />
                            <span>Task Master</span>
                          </a>
                        </Link>
                      </li>
                      <li>
                        <Link href={`/under-construction/Resource-Master`}>
                          <a className={cn(
                            "flex items-center px-4 py-2 text-gray-600 hover:bg-gray-50",
                            isActive('/under-construction/Resource-Master') && "text-teal-600 font-medium bg-teal-50"
                          )}>
                            <Users className="mr-3 h-5 w-5" />
                            <span>Resource Master</span>
                          </a>
                        </Link>
                      </li>
                    </ul>

                    <div className="px-4 py-2 border-t border-gray-200">
                      <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Reports & Analytics
                      </h2>
                    </div>
                    <ul className="py-1">
                      <li>
                        <Link href={`/under-construction/Charts`}>
                          <a className={cn(
                            "flex items-center px-4 py-2 text-gray-600 hover:bg-gray-50",
                            isActive('/under-construction/Charts') && "text-teal-600 font-medium bg-teal-50"
                          )}>
                            <PieChart className="mr-3 h-5 w-5" />
                            <span>Charts</span>
                          </a>
                        </Link>
                      </li>
                      <li>
                        <Link href={`/under-construction/Reports`}>
                          <a className={cn(
                            "flex items-center px-4 py-2 text-gray-600 hover:bg-gray-50",
                            isActive('/under-construction/Reports') && "text-teal-600 font-medium bg-teal-50"
                          )}>
                            <FileText className="mr-3 h-5 w-5" />
                            <span>Reports</span>
                          </a>
                        </Link>
                      </li>
                    </ul>
                  </>
                )}
              </>
            )}
          </div>
          
          {currentProject && (
            <div className="border-t border-gray-200 p-4">
              <div className="text-sm text-gray-500 mb-2">Current Project:</div>
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium truncate">{currentProject.name}</div>
                <div className="flex space-x-1">
                  <button className="text-gray-500 hover:text-primary-600" title="Project Settings">
                    <Settings size={14} />
                  </button>
                  <button className="text-gray-500 hover:text-green-600" title="Export Data">
                    <Download size={14} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>

      <AddProjectModal
        isOpen={isAddProjectModalOpen}
        onClose={() => setIsAddProjectModalOpen(false)}
        onSuccess={(projectId) => {
          setIsAddProjectModalOpen(false);
          setLocation(`/projects/${projectId}`);
        }}
      />
      
      {isMobile && isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-20"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
