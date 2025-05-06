import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { SideNavigation } from "@/components/project/side-navigation";
import { ProjectHeader } from "@/components/project/project-header";
import { useMobile } from "@/hooks/use-mobile";

interface ProjectLayoutProps {
  children: React.ReactNode;
  projectId: number;
}

export default function ProjectLayout({ children, projectId }: ProjectLayoutProps) {
  const isMobile = useMobile();
  const [isSidebarOpen, setIsSidebarOpen] = useState(!isMobile);
  const [, setLocation] = useLocation();

  // Validate the projectId
  useEffect(() => {
    if (isNaN(projectId) || projectId <= 0) {
      setLocation("/");
    }
  }, [projectId, setLocation]);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Top Navigation */}
      <header className="bg-white shadow-sm border-b border-gray-200 h-16 flex-shrink-0">
        <div className="flex justify-between items-center px-4 py-2 h-full">
          <div className="flex items-center">
            <div className="mr-2 cursor-pointer" onClick={() => setLocation('/')}>
              <img src="/smartproject.png" alt="ConstructPro Logo" className="h-8 w-auto" />
            </div>
            <h1 className="text-xl font-semibold text-gray-800 cursor-pointer" onClick={() => setLocation('/')}>ConstructPro</h1>
          </div>
          <div className="flex items-center space-x-4">
            <button className="text-gray-500 hover:text-gray-700">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3Z"></path>
                <path d="M8 17v1a4 4 0 0 0 8 0v-1"></path>
                <path d="M17 9v1"></path>
                <path d="M19.4 7.4L19.4 7.4"></path>
                <path d="M7 9v1"></path>
                <path d="M4.6 7.4L4.6 7.4"></path>
              </svg>
            </button>
            <button className="text-gray-500 hover:text-gray-700">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            </button>
            <div className="relative">
              <button className="flex items-center focus:outline-none">
                <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-white">
                  <span className="text-sm">JD</span>
                </div>
                <span className="ml-2 text-sm font-medium hidden md:block">John Doe</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar Navigation */}
        <SideNavigation currentProjectId={projectId} />

        {/* Main Content Area - Updated to enable scrolling */}
        <main className="flex-1 flex flex-col">
          {/* Project Header & Tabs */}
          <ProjectHeader 
            projectId={projectId} 
            onToggleSidebar={toggleSidebar} 
          />

          {/* Content - Updated to enable scrolling with overflow-y-auto */}
          <div className="flex-1 overflow-y-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
