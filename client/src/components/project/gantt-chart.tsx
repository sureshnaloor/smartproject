import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { WbsItem, Dependency } from "@shared/schema";
import { formatShortDate, calculateDependencyConstraints } from "@/lib/utils";
import { ChevronDown, ChevronRight, Calendar, PlusCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Create a custom TooltipPortal to ensure tooltips are rendered at the root level
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
const TooltipPortal = TooltipPrimitive.Portal;

interface GanttChartProps {
  projectId: number;
  onAddActivity?: (parentId: number) => void;
}

interface GanttItemProps {
  item: WbsItem & { children?: (WbsItem & { children?: any[] })[] };
  startDate: Date;
  totalDays: number;
  level: number;
  isExpanded: boolean;
  onToggleExpand: (id: number) => void;
  expandedItems?: Record<number, boolean>;
  onAddActivity?: (parentId: number) => void;
  isBudgetFinalized?: boolean;
  loadingItems: Set<number>;
}

// Helper function to format percentage
const formatPercent = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined) return "0%";
  return `${Math.round(Number(value))}%`;
};

const formatDate = (date: string | null | undefined): string => {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
};

export function GanttChart({ projectId, onAddActivity }: GanttChartProps) {
  const [expandedItems, setExpandedItems] = useState<Record<number, boolean>>({});
  const [timeScale, setTimeScale] = useState<"weeks" | "months">("months");
  const [showCalendar, setShowCalendar] = useState<boolean>(true);
  const debuggedItems = useRef(false);
  const itemsDataVersion = useRef<string>("");
  const [loadingItems, setLoadingItems] = useState<Set<number>>(new Set());
  
  // Fetch WBS items for the project
  const { data: wbsItems = [], isLoading: isLoadingWbs } = useQuery<WbsItem[]>({
    queryKey: [`/api/projects/${projectId}/wbs`],
  });

  // DEBUG: Check for duplicate items by ID, but only once per data change
  useEffect(() => {
    // Create a data version string to track changes
    const currentVersion = JSON.stringify(wbsItems.map(item => item.id).sort());
    
    // Skip if we've already debugged this exact set of items
    if (debuggedItems.current && currentVersion === itemsDataVersion.current) return;
    
    debuggedItems.current = true;
    itemsDataVersion.current = currentVersion;
    
    // Create a map of ID occurrences
    const idCount = new Map<number, number>();
    wbsItems.forEach(item => {
      const count = idCount.get(item.id) || 0;
      idCount.set(item.id, count + 1);
    });
    
    // Find any IDs that appear more than once
    const duplicates = Array.from(idCount.entries())
      .filter(([id, count]) => count > 1)
      .map(([id, count]) => {
        const items = wbsItems.filter(item => item.id === id);
        return { id, count, items };
      });
    
    if (duplicates.length > 0) {
      console.warn('Duplicate WBS items detected in gantt-chart.tsx:', duplicates);
    }
    
    // Reset debugged flag when component unmounts
    return () => {
      debuggedItems.current = false;
    };
  }, [wbsItems]);

  // Initialize all top-level items as expanded
  useEffect(() => {
    const topLevelItems = wbsItems.filter(item => item.isTopLevel);
    
    // Skip if no top level items or we've already set them
    if (topLevelItems.length === 0 || Object.keys(expandedItems).length > 0) return;
    
    const initialExpanded: Record<number, boolean> = {};
    
    topLevelItems.forEach(item => {
      initialExpanded[item.id] = true;
    });
    
    setExpandedItems(prev => ({
      ...prev,
      ...initialExpanded
    }));
  }, [wbsItems, expandedItems]);

  // Create a custom fetch function for dependencies
  const fetchDependencies = async () => {
    // Skip if no WBS items
    if (!wbsItems || wbsItems.length === 0) return [];
    
    try {
      // Use a specific endpoint to get all dependencies for this project
      const response = await fetch(`/api/projects/${projectId}/dependencies`, {
        credentials: "include",
      });
      
      if (response.ok) {
        const data = await response.json();
        return data;
      } else {
        console.warn("Failed to fetch dependencies from project endpoint, falling back to per-activity approach");
        throw new Error("Failed to fetch from project endpoint");
      }
    } catch (error) {
      // Fallback to fetching individually if the project endpoint fails
      console.log("Falling back to fetching dependencies for each activity");
      
      const activityItems = wbsItems.filter(item => item.type === "Activity");
      const allDependencies: Dependency[] = [];
      const uniqueKeys = new Set<string>();
      
      for (const item of activityItems) {
        try {
          const response = await fetch(`/api/wbs/${item.id}/dependencies`, {
            credentials: "include",
          });
          
          if (response.ok) {
            const deps = await response.json();
            // Only add dependencies we haven't seen before
            deps.forEach((dep: Dependency) => {
              const key = `${dep.predecessorId}-${dep.successorId}`;
              if (!uniqueKeys.has(key)) {
                uniqueKeys.add(key);
                allDependencies.push(dep);
              }
            });
          }
        } catch (itemError) {
          console.error(`Error fetching dependencies for item ${item.id}:`, itemError);
        }
      }
      
      return allDependencies;
    }
  };

  // Query for dependencies with the custom fetch function
  const { data: dependencies = [], isLoading: isLoadingDeps } = useQuery<Dependency[]>({
    queryKey: [`dependencies-for-project-${projectId}`],
    queryFn: fetchDependencies,
    enabled: wbsItems.length > 0,
  });

  // Calculate project timeline based only on Activity items
  const { startDate, endDate, totalDays, todayPosition } = useMemo(() => {
    // Filter to only Activity items with dates
    const activitiesWithDates = wbsItems.filter(
      item => item.type === "Activity" && item.startDate && item.endDate
    );
    
    if (activitiesWithDates.length === 0) {
      const today = new Date();
      const sixMonthsLater = new Date(today);
      sixMonthsLater.setMonth(today.getMonth() + 6);
      
      return {
        startDate: today,
        endDate: sixMonthsLater,
        totalDays: 180, // Approximate
        todayPosition: 0 // At the start
      };
    }
    
    let minDate = new Date(activitiesWithDates[0].startDate as string);
    let maxDate = new Date(activitiesWithDates[0].endDate as string);
    
    activitiesWithDates.forEach(item => {
      if (!item.startDate || !item.endDate) return;
      
      const itemStartDate = new Date(item.startDate);
      const itemEndDate = new Date(item.endDate);
      
      if (itemStartDate < minDate) minDate = itemStartDate;
      if (itemEndDate > maxDate) maxDate = itemEndDate;
    });
    
    // Add buffer days
    minDate.setDate(minDate.getDate() - 7);
    maxDate.setDate(maxDate.getDate() + 7);
    
    const diffTime = Math.abs(maxDate.getTime() - minDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // Calculate today's position as percentage
    const today = new Date();
    let todayPosition = 0;
    
    if (today >= minDate && today <= maxDate) {
      const diffFromStart = Math.abs(today.getTime() - minDate.getTime());
      const diffDaysFromStart = Math.ceil(diffFromStart / (1000 * 60 * 60 * 24));
      todayPosition = (diffDaysFromStart / diffDays) * 100;
    } else if (today < minDate) {
      todayPosition = 0;
    } else {
      todayPosition = 100;
    }
    
    return {
      startDate: minDate,
      endDate: maxDate,
      totalDays: diffDays,
      todayPosition
    };
  }, [wbsItems]);

  // Generate time scale headers
  const timeScaleHeaders = useMemo(() => {
    const headers = [];
    const currentDate = new Date(startDate);
    
    if (timeScale === "months") {
      while (currentDate <= endDate) {
        const month = currentDate.toLocaleString('default', { month: 'short' });
        const year = currentDate.getFullYear();
        headers.push(`${month} ${year}`);
        
        currentDate.setMonth(currentDate.getMonth() + 1);
      }
    } else {
      while (currentDate <= endDate) {
        const month = currentDate.toLocaleString('default', { month: 'short' });
        const day = currentDate.getDate();
        headers.push(`${month} ${day}`);
        
        currentDate.setDate(currentDate.getDate() + 7);
      }
    }
    
    return headers;
  }, [startDate, endDate, timeScale]);

  // Handle expand/collapse with loading indicator
  const toggleExpand = (itemId: number) => {
    // If we're expanding, show the loading state
    if (!expandedItems[itemId]) {
      // First set expanded state immediately for responsiveness
      setExpandedItems(prev => ({
        ...prev,
        [itemId]: true
      }));
      
      // Then add this item to loading set
      setLoadingItems(prev => {
        const newSet = new Set(prev);
        newSet.add(itemId);
        return newSet;
      });
      
      // Adaptive loading time based on number of children
      const item = wbsItems.find(wi => wi.id === itemId);
      const childCount = item ? wbsItems.filter(child => child.parentId === itemId).length : 0;
      const loadingTime = Math.min(200 + childCount * 20, 500); // Base 200ms + 20ms per child, max 500ms
      
      // Simulate loading time
      setTimeout(() => {
        setLoadingItems(prev => {
          const newSet = new Set(prev);
          newSet.delete(itemId);
          return newSet;
        });
      }, loadingTime);
    } else {
      // If collapsing, no need for loading state - just collapse immediately
      setExpandedItems(prev => ({
        ...prev,
        [itemId]: false
      }));
    }
  };

  // Expand all
  const expandAll = () => {
    const allExpanded: Record<number, boolean> = {};
    wbsItems.forEach(item => {
      allExpanded[item.id] = true;
    });
    setExpandedItems(allExpanded);
  };

  // Collapse all
  const collapseAll = () => {
    const onlyTopLevel: Record<number, boolean> = {};
    wbsItems
      .filter(item => item.isTopLevel)
      .forEach(item => {
        onlyTopLevel[item.id] = true;
      });
    setExpandedItems(onlyTopLevel);
  };

  // Create a hierarchical structure
  const hierarchicalItems = useMemo(() => {
    if (!wbsItems.length) return [];
    
    // Track which items have already been added to any parent
    const addedToParent = new Set<number>();
    
    // Map of items by id with empty children array
    const itemMap = new Map<number, WbsItem & { children: (WbsItem & { children: any[] })[] }>();
    
    // Initialize all items in the map
    wbsItems.forEach(item => {
      itemMap.set(item.id, { ...item, children: [] });
    });
    
    // Root items array for top-level items
    const rootItems: (WbsItem & { children: any[] })[] = [];
    
    // First, add root items (null parent)
    wbsItems
      .filter(item => item.parentId === null)
      .forEach(item => {
        rootItems.push(itemMap.get(item.id) as any);
      });
    
    // Then, sort non-root items by level to ensure proper hierarchy
    const nonRootItems = [...wbsItems]
      .filter(item => item.parentId !== null)
      .sort((a, b) => a.level - b.level);
    
    for (const item of nonRootItems) {
      // Skip if already added to a parent
      if (addedToParent.has(item.id)) continue;
      
      const parentId = item.parentId as number;
      const parent = itemMap.get(parentId);
      
      if (parent) {
        // Add this item to its parent's children array
        parent.children.push(itemMap.get(item.id) as any);
        // Mark as added to avoid duplicates
        addedToParent.add(item.id);
      }
    }
    
    return rootItems;
  }, [wbsItems]);

  // Query to check if budget is finalized
  const { data: project } = useQuery<{ id: number; name: string; budget: number }>(
    { queryKey: [`/api/projects/${projectId}`] }
  );
  
  // Calculate if budget is finalized
  const isBudgetFinalized = useMemo(() => {
    if (!wbsItems.length) return false;
    
    // Get all top-level items (Summary type)
    const topLevelItems = wbsItems.filter(item => item.isTopLevel && item.type === "Summary");
    
    // Sum up all top-level budgets
    const totalAllocated = topLevelItems.reduce((total, item) => {
      return total + Number(item.budgetedCost || 0);
    }, 0);
    
    // Get all work packages
    const workPackages = wbsItems.filter(item => item.type === "WorkPackage");
    
    // Sum up all work package budgets
    const totalWorkPackageBudget = workPackages.reduce((total, wp) => {
      return total + Number(wp.budgetedCost || 0);
    }, 0);
    
    // Budget is finalized when the sums match and are greater than 0
    return Math.abs(totalWorkPackageBudget - totalAllocated) < 0.01 && totalWorkPackageBudget > 0;
  }, [wbsItems]);

  // Recursive function to render WBS items with better duplicate handling
  const renderWbsItems = (
    items: (WbsItem & { children: any[] })[],
    level = 0,
    renderedItems = new Set<number>()
  ): JSX.Element[] => {
    const result: JSX.Element[] = [];
    
    items
      .sort((a, b) => a.code.localeCompare(b.code))
      .forEach(item => {
        // Skip if this item has already been rendered
        if (renderedItems.has(item.id)) {
          return;
        }
        
        // Mark this item as rendered
        renderedItems.add(item.id);
        
        const isExpanded = !!expandedItems[item.id];
        const isLoading = loadingItems.has(item.id);
        
        result.push(
          <div key={item.id}>
            <GanttItem
              item={item}
              startDate={startDate}
              totalDays={totalDays}
              level={level}
              isExpanded={isExpanded}
              onToggleExpand={toggleExpand}
              expandedItems={expandedItems}
              onAddActivity={onAddActivity}
              isBudgetFinalized={isBudgetFinalized}
              loadingItems={loadingItems}
            />
            
            {isExpanded && (
              <div className="transition-all duration-300 ease-in-out overflow-hidden"
                   style={{ 
                     opacity: isLoading ? 0 : 1,
                     maxHeight: isLoading ? '80px' : '2000px', // Allow space for skeleton while loading
                     transform: isLoading ? 'translateY(-8px)' : 'translateY(0)'
                   }}>
                {isLoading ? (
                  <div className="py-2 ml-8 animate-pulse">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full mt-1" />
                  </div>
                ) : (
                  item.children?.length > 0 && 
                  <div className="animate-fadeIn">
                    {renderWbsItems(item.children, level + 1, renderedItems)}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      });
    
    return result;
  };

  if (isLoadingWbs) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-8 w-full max-w-md" />
        <Skeleton className="h-[200px] w-full" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-4 border-b border-gray-200 flex justify-between items-center">
        <div className="flex items-center">
          <h3 className="text-base font-semibold">Project Schedule</h3>
          <div className="ml-4">
            <Select
              value={timeScale}
              onValueChange={(value: "weeks" | "months") => setTimeScale(value)}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Time scale" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weeks">Weeks</SelectItem>
                <SelectItem value="months">Months</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="ml-2"
            onClick={() => setShowCalendar(!showCalendar)}
          >
            {showCalendar ? "Hide Calendar" : "Show Calendar"}
          </Button>
        </div>
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={expandAll}
          >
            <ChevronDown className="h-4 w-4 mr-1.5" />
            Expand All
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={collapseAll}
          >
            <ChevronRight className="h-4 w-4 mr-1.5" />
            Collapse All
          </Button>
        </div>
      </div>

      {isLoadingWbs || isLoadingDeps ? (
        <div className="space-y-4 p-4">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[800px]">
            <div className="grid grid-cols-[250px_1fr] border-b border-gray-200">
              <div className="py-2 px-4 font-medium text-sm bg-gray-50">
                WBS Item
              </div>
              {showCalendar && (
                <div className="grid" style={{ gridTemplateColumns: `repeat(${timeScaleHeaders.length}, 1fr)` }}>
                  {timeScaleHeaders.map((header, index) => (
                    <div 
                      key={index} 
                      className="py-2 px-1 font-medium text-xs text-center bg-gray-50"
                    >
                      {header}
                    </div>
                  ))}
                </div>
              )}
              {!showCalendar && (
                <div className="py-2 px-4 font-medium text-sm bg-gray-50 text-center">
                  Timeline (hover over bars for dates)
                </div>
              )}
            </div>
            
            <div className="relative">
              {/* Vertical date lines */}
              {showCalendar && (
                <div 
                  className="absolute inset-0 grid pointer-events-none" 
                  style={{ gridTemplateColumns: `repeat(${timeScaleHeaders.length}, 1fr)` }}
                >
                  {timeScaleHeaders.map((_, index) => (
                    <div key={index} className="h-full border-r border-gray-200 last:border-r-0"></div>
                  ))}
                </div>
              )}
              
              {/* Today indicator line */}
              {todayPosition > 0 && todayPosition < 100 && (
                <div 
                  className="absolute top-0 bottom-0 w-[2px] bg-red-500 z-10 pointer-events-none"
                  style={{ left: `calc(250px + (100% - 250px) * ${todayPosition / 100})` }}
                >
                  <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded whitespace-nowrap">
                    Today
                  </div>
                </div>
              )}
              
              {hierarchicalItems.length === 0 ? (
                <div className="px-4 py-3 text-center text-gray-500">
                  No scheduled items found.
                </div>
              ) : (
                renderWbsItems(hierarchicalItems)
              )}
            </div>
          </div>
        </div>
      )}
      
      <div className="p-3 bg-blue-50 rounded-md text-sm text-blue-700 m-4">
        <p className="font-medium mb-1">Note:</p>
        <p>
          In the current WBS structure, only Activity items have schedules. 
          Summary and WorkPackage items are used for budget organization and do not have dates.
        </p>
        
        {/* Add legend for colors and indicators */}
        <div className="mt-3 pt-3 border-t border-blue-200">
          <p className="font-medium mb-2">Legend:</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-gray-400 rounded-sm mr-2"></div>
              <span>Not Started (0%)</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-blue-500 rounded-sm mr-2"></div>
              <span>In Progress (1-99%)</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-green-500 rounded-sm mr-2"></div>
              <span>Complete (100%)</span>
            </div>
            <div className="flex items-center">
              <div className="w-2 h-3 bg-red-500 mr-2"></div>
              <span>Today</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function GanttItem({
  item,
  startDate,
  totalDays,
  level,
  isExpanded,
  onToggleExpand,
  expandedItems = {},
  onAddActivity,
  isBudgetFinalized,
  loadingItems
}: GanttItemProps) {
  const hasChildren = item.children && item.children.length > 0;
  const isLoading = loadingItems.has(item.id);

  // Calculate position and width for the activity bar
  const calculatePosition = () => {
    // Only Activity items have dates and should be displayed on the timeline
    if (item.type !== "Activity" || !item.startDate || !item.endDate) {
      return {
        left: 0,
        width: 0,
        display: "none"
      };
    }
    
    const itemStartDate = new Date(item.startDate);
    const itemEndDate = new Date(item.endDate);
    
    const diffStartTime = Math.abs(itemStartDate.getTime() - startDate.getTime());
    const diffStartDays = Math.ceil(diffStartTime / (1000 * 60 * 60 * 24));
    
    const diffDuration = Math.abs(itemEndDate.getTime() - itemStartDate.getTime());
    const durationDays = Math.ceil(diffDuration / (1000 * 60 * 60 * 24)) + 1; // Include end day
    
    const left = (diffStartDays / totalDays) * 100;
    const width = (durationDays / totalDays) * 100;
    
    return {
      left: `${left}%`,
      width: `${width}%`,
      display: "block"
    };
  };

  const getBarColor = () => {
    if (item.type !== "Activity") return "";
    
    const progress = Number(item.percentComplete);
    
    if (progress >= 100) return "bg-green-500";
    if (progress > 0) return "bg-blue-500";
    return "bg-gray-400";
  };

  const paddingLeft = `${level * 16 + 4}px`;
  
  return (
    <>
      <div className="grid grid-cols-[250px_1fr] border-b border-gray-100">
        <div className="py-2 px-2 flex items-center" style={{ paddingLeft }}>
          {hasChildren ? (
            <button
              type="button"
              onClick={() => onToggleExpand(item.id)}
              className="mr-1 text-gray-500 h-5 w-5 flex items-center justify-center"
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
              ) : isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          ) : (
            <span className="w-5"></span>
          )}
          <div className="ml-1 flex items-center">
            <div>
              <div className="text-sm font-medium">{item.name}</div>
              {item.type === "Activity" && item.startDate && item.endDate && (
                <div className="text-xs text-gray-500">
                  {formatShortDate(item.startDate)} - {formatShortDate(item.endDate)}
                </div>
              )}
            </div>
            {item.type === "WorkPackage" && onAddActivity && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 ml-2"
                onClick={() => onAddActivity(item.id)}
                title="Add Activity"
              >
                <PlusCircle className="h-4 w-4 text-blue-500" />
              </Button>
            )}
          </div>
        </div>
        <div className="relative h-8 py-1 flex">
          {item.type === "Activity" && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div 
                    className={`absolute h-6 ${getBarColor()} rounded-sm opacity-90 cursor-pointer hover:opacity-100 transition-opacity`}
                    style={calculatePosition()}
                  >
                    <div 
                      className="absolute inset-0 flex items-center justify-center text-xs text-white font-medium"
                      style={{ padding: "0 8px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    >
                      {formatPercent(item.percentComplete)}
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipPortal>
                  <TooltipContent 
                    className="p-0 bg-white rounded-md shadow-lg border border-gray-200"
                    sideOffset={10}
                    side="top"
                    align="center"
                  >
                    <div className="p-4 w-64">
                      <div className="font-medium text-sm mb-2">{item.name}</div>
                      {item.startDate && item.endDate && (
                        <div className="grid grid-cols-2 gap-3 mt-2 text-xs">
                          <div>
                            <div className="text-gray-500 mb-0.5">Start Date</div>
                            <div className="font-medium">{formatDate(item.startDate)}</div>
                          </div>
                          <div>
                            <div className="text-gray-500 mb-0.5">End Date</div>
                            <div className="font-medium">{formatDate(item.endDate)}</div>
                          </div>
                          <div>
                            <div className="text-gray-500 mb-0.5">Duration</div>
                            <div className="font-medium">
                              {Math.ceil(
                                (new Date(item.endDate).getTime() - new Date(item.startDate).getTime()) / 
                                (1000 * 60 * 60 * 24)
                              ) + 1} days
                            </div>
                          </div>
                          <div>
                            <div className="text-gray-500 mb-0.5">Progress</div>
                            <div className="font-medium">{formatPercent(item.percentComplete)}</div>
                          </div>
                          {item.description && (
                            <div className="col-span-2 mt-1">
                              <div className="text-gray-500 mb-0.5">Description</div>
                              <div className="font-medium text-xs">{item.description}</div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </TooltipContent>
                </TooltipPortal>
              </Tooltip>
            </TooltipProvider>
          )}
          {item.type !== "Activity" && (
            <div className="absolute inset-0 flex items-center px-4">
              <span className="text-xs text-gray-400">
                {item.type === "Summary" ? "Summary Item" : "Work Package"}
              </span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
