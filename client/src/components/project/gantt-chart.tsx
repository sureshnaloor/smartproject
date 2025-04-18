import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { WbsItem, Dependency } from "@shared/schema";
import { formatShortDate, calculateDependencyConstraints } from "@/lib/utils";
import { ChevronDown, ChevronRight, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface GanttChartProps {
  projectId: number;
}

interface GanttItemProps {
  item: WbsItem;
  startDate: Date;
  totalDays: number;
  level: number;
  isExpanded: boolean;
  onToggleExpand: (id: number) => void;
}

export function GanttChart({ projectId }: GanttChartProps) {
  const [expandedItems, setExpandedItems] = useState<Record<number, boolean>>({});
  const [timeScale, setTimeScale] = useState<"weeks" | "months">("months");
  
  // Fetch WBS items for the project
  const { data: wbsItems = [], isLoading: isLoadingWbs } = useQuery<WbsItem[]>({
    queryKey: [`/api/projects/${projectId}/wbs`],
  });

  // Initialize all top-level items as expanded
  useEffect(() => {
    const topLevelItems = wbsItems.filter(item => item.isTopLevel);
    const initialExpanded: Record<number, boolean> = {};
    
    topLevelItems.forEach(item => {
      initialExpanded[item.id] = true;
    });
    
    setExpandedItems(prev => ({
      ...prev,
      ...initialExpanded
    }));
  }, [wbsItems]);

  // Fetch dependencies
  const fetchDependenciesForItems = async () => {
    const allDependencies: Dependency[] = [];
    
    // Only Activity items can have dependencies
    const activityItems = wbsItems.filter(item => item.type === "Activity");
    
    for (const item of activityItems) {
      const response = await fetch(`/api/wbs/${item.id}/dependencies`, {
        credentials: "include",
      });
      if (response.ok) {
        const deps = await response.json();
        allDependencies.push(...deps);
      }
    }
    
    return allDependencies;
  };

  const { data: dependencies = [], isLoading: isLoadingDeps } = useQuery<Dependency[]>({
    queryKey: [`/api/projects/${projectId}/dependencies`],
    queryFn: fetchDependenciesForItems,
    enabled: wbsItems.length > 0,
  });

  // Calculate project timeline based only on Activity items
  const { startDate, endDate, totalDays } = useMemo(() => {
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
        totalDays: 180 // Approximate
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
    
    return {
      startDate: minDate,
      endDate: maxDate,
      totalDays: diffDays
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

  // Handle expand/collapse
  const toggleExpand = (itemId: number) => {
    setExpandedItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
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
    const itemMap = new Map<number, WbsItem & { children: (WbsItem & { children: any[] })[] }>();
    
    // Initialize with empty children array
    wbsItems.forEach(item => {
      itemMap.set(item.id, { ...item, children: [] });
    });
    
    // Build the hierarchy
    const rootItems: (WbsItem & { children: any[] })[] = [];
    
    itemMap.forEach(item => {
      if (item.parentId === null) {
        rootItems.push(item);
      } else {
        const parent = itemMap.get(item.parentId);
        if (parent) {
          parent.children.push(item);
        }
      }
    });
    
    return rootItems;
  }, [wbsItems]);

  // Recursive function to render WBS items
  const renderWbsItems = (
    items: (WbsItem & { children: any[] })[],
    level = 0
  ): JSX.Element[] => {
    return items
      .sort((a, b) => a.code.localeCompare(b.code))
      .map(item => {
        const isExpanded = !!expandedItems[item.id];
        
        return (
          <div key={item.id}>
            <GanttItem
              item={item}
              startDate={startDate}
              totalDays={totalDays}
              level={level}
              isExpanded={isExpanded}
              onToggleExpand={toggleExpand}
            />
            
            {isExpanded && item.children.length > 0 && (
              <div>
                {renderWbsItems(item.children, level + 1)}
              </div>
            )}
          </div>
        );
      });
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
            </div>
            
            <div>
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
  onToggleExpand
}: GanttItemProps) {
  const hasChildren = item.children && item.children.length > 0;

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
              className="mr-1 text-gray-500"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          ) : (
            <span className="w-5"></span>
          )}
          <div className="ml-1">
            <div className="text-sm font-medium">{item.name}</div>
            {item.type === "Activity" && item.startDate && item.endDate && (
              <div className="text-xs text-gray-500">
                {formatShortDate(item.startDate)} - {formatShortDate(item.endDate)}
              </div>
            )}
          </div>
        </div>
        <div className="relative h-8 py-1 flex">
          {item.type === "Activity" && (
            <div 
              className={`absolute h-6 ${getBarColor()} rounded-sm opacity-90`}
              style={calculatePosition()}
            >
              <div 
                className="absolute inset-0 flex items-center justify-center text-xs text-white font-medium"
                style={{ padding: "0 8px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              >
                {formatPercent(item.percentComplete)}
              </div>
            </div>
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
      
      {isExpanded && hasChildren && (
        <>
          {item.children.map(child => (
            <GanttItem
              key={child.id}
              item={child}
              startDate={startDate}
              totalDays={totalDays}
              level={level + 1}
              isExpanded={!!expandedItems[child.id]}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </>
      )}
    </>
  );
}
