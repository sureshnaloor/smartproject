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
    
    for (const item of wbsItems) {
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

  // Calculate project timeline
  const { startDate, endDate, totalDays } = useMemo(() => {
    if (wbsItems.length === 0) {
      const today = new Date();
      const sixMonthsLater = new Date(today);
      sixMonthsLater.setMonth(today.getMonth() + 6);
      
      return {
        startDate: today,
        endDate: sixMonthsLater,
        totalDays: 180 // Approximate
      };
    }
    
    let minDate = new Date(wbsItems[0].startDate);
    let maxDate = new Date(wbsItems[0].endDate);
    
    wbsItems.forEach(item => {
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
        <h3 className="text-base font-semibold">Project Schedule</h3>
        <div className="flex items-center space-x-2">
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
          <Select
            value={timeScale}
            onValueChange={(value: "weeks" | "months") => setTimeScale(value)}
          >
            <SelectTrigger className="w-[120px] h-9">
              <Calendar className="h-4 w-4 mr-1.5" />
              <SelectValue placeholder="View" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weeks">Weekly View</SelectItem>
              <SelectItem value="months">Monthly View</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-max">
          {/* Timeline Header */}
          <div className="flex border-b border-gray-200">
            <div className="w-64 flex-shrink-0 px-4 py-2 bg-gray-50 border-r border-gray-200 font-medium text-sm">
              Work Breakdown Structure
            </div>
            <div className="flex-grow">
              <div className="grid" style={{ gridTemplateColumns: `repeat(${timeScaleHeaders.length}, minmax(90px, 1fr))` }}>
                {timeScaleHeaders.map((header, idx) => (
                  <div key={idx} className="px-2 py-2 text-center text-xs font-medium border-r border-gray-200">
                    {header}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* WBS Rows with Gantt bars */}
          <div>
            {hierarchicalItems.length === 0 ? (
              <div className="px-4 py-6 text-center text-gray-500">
                No WBS items found. Add items to see the schedule.
              </div>
            ) : (
              renderWbsItems(hierarchicalItems)
            )}
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
  onToggleExpand
}: GanttItemProps) {
  // Calculate position for the gantt bar
  const calculatePosition = () => {
    const itemStartDate = new Date(item.startDate);
    const itemEndDate = new Date(item.endDate);
    
    const startDiff = Math.max(0, (itemStartDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const duration = Math.max(1, (itemEndDate.getTime() - itemStartDate.getTime()) / (1000 * 60 * 60 * 24) + 1);
    
    const left = (startDiff / totalDays) * 100;
    const width = (duration / totalDays) * 100;
    
    return {
      left: `${left}%`,
      width: `${width}%`,
    };
  };

  // Get color based on item type
  const getBarColor = () => {
    if (item.isTopLevel) {
      if (item.code === "1") return "bg-blue-500"; // Engineering & Design
      if (item.code === "2") return "bg-primary-500"; // Procurement & Construction
      if (item.code === "3") return "bg-gray-400"; // Testing & Commissioning
    }
    
    if (item.type === "Summary") return "bg-blue-400";
    if (item.type === "Activity") return "bg-primary-400";
    return "bg-amber-400"; // Task
  };

  const barPosition = calculatePosition();
  const barColor = getBarColor();
  const paddingLeft = `${level * 1.5}rem`;

  return (
    <div className="flex border-b border-gray-200 hover:bg-gray-50 transition-colors">
      <div 
        className="w-64 flex-shrink-0 px-4 py-3 border-r border-gray-200"
      >
        <div 
          className="flex items-center" 
          style={{ paddingLeft }}
        >
          {item.children && item.children.length > 0 ? (
            <button 
              onClick={() => onToggleExpand(item.id)}
              className="mr-2 text-gray-500 p-1 hover:bg-gray-200 rounded-sm"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          ) : (
            <div className="w-6 mr-2"></div>
          )}
          <div className="text-sm truncate">
            <span className={`${item.isTopLevel ? 'font-medium' : ''}`}>
              {item.name}
            </span>
            {(item.actualStartDate || item.percentComplete > 0) && (
              <span className={`ml-2 text-xs ${
                Number(item.percentComplete) === 100 
                  ? 'text-green-600' 
                  : Number(item.percentComplete) > 0 
                    ? 'text-blue-600' 
                    : 'text-gray-500'
              }`}>
                ({item.percentComplete}%)
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex-grow relative h-10">
        <div 
          className={`absolute h-5 top-2.5 rounded ${barColor}`} 
          style={{ 
            left: barPosition.left, 
            width: barPosition.width,
            opacity: 0.8
          }}
          title={`${item.name}: ${formatShortDate(item.startDate)} - ${formatShortDate(item.endDate)}`}
        >
          {barPosition.width > 8 && (
            <div className="text-xs text-white truncate px-1.5 leading-5">
              {item.name} ({item.duration}d)
            </div>
          )}
        </div>
        
        {/* Progress bar overlay */}
        {Number(item.percentComplete) > 0 && (
          <div 
            className="absolute h-5 top-2.5 rounded bg-green-600 bg-opacity-70" 
            style={{ 
              left: barPosition.left, 
              width: `calc(${barPosition.width} * ${Number(item.percentComplete) / 100})`,
              opacity: 0.8
            }}
          />
        )}
      </div>
    </div>
  );
}
