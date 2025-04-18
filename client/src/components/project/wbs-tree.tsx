import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { WbsItem, UpdateWbsProgress } from "@shared/schema";
import { formatCurrency, formatDate, formatPercent, buildWbsHierarchy } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ChevronDown, ChevronRight, Edit, Trash2, Plus, Clipboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddWbsModal } from "./add-wbs-modal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface WbsTreeProps {
  projectId: number;
}

interface TreeItemProps {
  item: WbsItem;
  projectId: number;
  level: number;
  onAddChild: (parentId: number) => void;
  onRefresh: () => void;
  onUpdateProgress: (item: WbsItem) => void;
}

export function WbsTree({ projectId }: WbsTreeProps) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedParentId, setSelectedParentId] = useState<number | null>(null);
  const [expandedItems, setExpandedItems] = useState<Record<number, boolean>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch WBS items for the project
  const { 
    data: wbsItems = [], 
    isLoading,
    refetch
  } = useQuery<WbsItem[]>({
    queryKey: [`/api/projects/${projectId}/wbs`],
  });

  // Build WBS hierarchy
  const rootItems = buildWbsHierarchy(wbsItems);

  const toggleExpand = (itemId: number) => {
    setExpandedItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  const handleAddChild = (parentId: number) => {
    setSelectedParentId(parentId);
    setIsAddModalOpen(true);
  };

  const handleAddTopLevel = () => {
    setSelectedParentId(null);
    setIsAddModalOpen(true);
  };

  const handleRefresh = () => {
    refetch();
  };

  const handleUpdateProgress = (item: WbsItem) => {
    // Logic to update progress (implemented in the TreeItem component)
  };

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-8 w-full max-w-md" />
        <Skeleton className="h-8 w-full max-w-lg" />
        <Skeleton className="h-8 w-full max-w-sm" />
      </div>
    );
  }

  const renderTree = (items: WbsItem[], level = 0) => {
    return items.map(item => (
      <TreeItem
        key={item.id}
        item={item}
        projectId={projectId}
        level={level}
        onAddChild={handleAddChild}
        onRefresh={handleRefresh}
        onUpdateProgress={handleUpdateProgress}
      />
    ));
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-4 border-b border-gray-200 flex justify-between items-center">
        <h3 className="text-base font-semibold">Work Breakdown Structure</h3>
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              Object.keys(wbsItems).forEach(key => {
                setExpandedItems(prev => ({
                  ...prev,
                  [Number(key)]: true
                }));
              });
            }}
          >
            <ChevronDown className="h-4 w-4 mr-1.5" />
            Expand All
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setExpandedItems({})}
          >
            <ChevronRight className="h-4 w-4 mr-1.5" />
            Collapse All
          </Button>
          <Button
            size="sm"
            onClick={handleAddTopLevel}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Add WBS Item
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-max">
          <div className="grid grid-cols-[minmax(300px,_1fr)_repeat(6,_minmax(120px,_1fr))] px-4 py-2 font-medium text-sm bg-gray-50 border-b border-gray-200">
            <div>WBS Item</div>
            <div>Code</div>
            <div>Type</div>
            <div>Budget</div>
            <div>Actual Cost</div>
            <div>Progress</div>
            <div>Actions</div>
          </div>

          <div className="divide-y divide-gray-100">
            {rootItems.length === 0 ? (
              <div className="px-4 py-3 text-center text-gray-500">
                No WBS items found. Click "Add WBS Item" to create one.
              </div>
            ) : (
              renderTree(rootItems)
            )}
          </div>
        </div>
      </div>

      <AddWbsModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        projectId={projectId}
        parentId={selectedParentId}
        onSuccess={handleRefresh}
      />
    </div>
  );
}

function TreeItem({ item, projectId, level, onAddChild, onRefresh, onUpdateProgress }: TreeItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isProgressDialogOpen, setIsProgressDialogOpen] = useState(false);
  const [progress, setProgress] = useState(Number(item.percentComplete));
  const [actualStartDate, setActualStartDate] = useState<Date | undefined>(
    item.actualStartDate ? new Date(item.actualStartDate) : undefined
  );
  const [actualEndDate, setActualEndDate] = useState<Date | undefined>(
    item.actualEndDate ? new Date(item.actualEndDate) : undefined
  );
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch child WBS items
  const { data: childItems = [] } = useQuery<WbsItem[]>({
    queryKey: [`/api/projects/${projectId}/wbs/children/${item.id}`],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}/wbs`);
      if (!response.ok) throw new Error("Failed to fetch WBS items");
      const allItems = await response.json();
      return allItems.filter((wbs: WbsItem) => wbs.parentId === item.id);
    },
    enabled: isExpanded,
  });

  // Delete WBS item mutation
  const deleteWbsItem = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", `/api/wbs/${item.id}`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/wbs`] });
      toast({
        title: "WBS Item Deleted",
        description: "The WBS item has been deleted successfully.",
        variant: "default",
      });
      setIsDeleteDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete WBS item. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update progress mutation
  const updateProgress = useMutation({
    mutationFn: async (data: UpdateWbsProgress) => {
      const response = await apiRequest("PATCH", `/api/wbs/${item.id}/progress`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/wbs`] });
      toast({
        title: "Progress Updated",
        description: "The progress has been updated successfully.",
        variant: "default",
      });
      setIsProgressDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update progress. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleProgressSubmit = () => {
    // Only allow setting actual dates for Activity type
    if (item.type !== "Activity" && (actualStartDate || actualEndDate)) {
      toast({
        title: "Validation Error",
        description: "Only Activity items can have actual start and end dates.",
        variant: "destructive",
      });
      return;
    }

    updateProgress.mutate({
      id: item.id,
      percentComplete: progress,
      actualStartDate,
      actualEndDate,
    });
  };

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  const formatIndent = (level: number) => {
    return Array(level).fill('—').join('');
  };

  const canHaveChildren = item.type !== "Activity";
  
  return (
    <>
      <div className="grid grid-cols-[minmax(300px,_1fr)_repeat(6,_minmax(120px,_1fr))] px-4 py-2 hover:bg-gray-50">
        <div className="flex items-center">
          <button
            type="button"
            className={`mr-1 ${canHaveChildren ? 'opacity-100' : 'opacity-0'}`}
            onClick={toggleExpand}
            disabled={!canHaveChildren}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-500" />
            )}
          </button>
          
          <div className="ml-1" style={{ marginLeft: `${level * 16}px` }}>
            <div className="font-medium text-sm">{item.name}</div>
            <div className="text-xs text-gray-500">{item.description}</div>
          </div>
        </div>
        
        <div className="text-sm">
          {item.code}
        </div>
        
        <div className="text-sm">
          <span className={`px-2 py-0.5 rounded-full text-xs ${
            item.type === "Summary" 
              ? "bg-blue-100 text-blue-800" 
              : item.type === "WorkPackage" 
                ? "bg-purple-100 text-purple-800" 
                : "bg-green-100 text-green-800"
          }`}>
            {item.type}
          </span>
        </div>
        
        <div className="text-sm">
          {item.type !== "Activity" && formatCurrency(item.budgetedCost)}
          {item.type === "Activity" && "N/A"}
        </div>
        
        <div className="text-sm">
          {item.type !== "Activity" && formatCurrency(item.actualCost)}
          {item.type === "Activity" && "N/A"}
        </div>
        
        <div className="text-sm">
          <div className="flex items-center">
            <div className="w-full bg-gray-200 rounded-full h-2 mr-2">
              <div 
                className="bg-blue-600 h-2 rounded-full" 
                style={{ width: `${Math.min(100, Number(item.percentComplete))}%` }}
              ></div>
            </div>
            <span className="whitespace-nowrap">{formatPercent(item.percentComplete)}</span>
          </div>
          {item.type === "Activity" && item.actualStartDate && (
            <div className="text-xs text-gray-500 mt-0.5">
              Started: {formatShortDate(item.actualStartDate)}
            </div>
          )}
        </div>
        
        <div className="flex space-x-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => onUpdateProgress(item)}
                  disabled={updateProgress.isPending}
                >
                  <Edit className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Update Progress</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          {canHaveChildren && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => onAddChild(item.id)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Add Child Item</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          
          {!item.isTopLevel && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-red-600"
                    onClick={() => setIsDeleteDialogOpen(true)}
                    disabled={deleteWbsItem.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Delete Item</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>
      
      {isExpanded && (
        <div className="divide-y divide-gray-100">
          {childItems.map((child) => (
            <TreeItem
              key={child.id}
              item={child}
              projectId={projectId}
              level={level + 1}
              onAddChild={onAddChild}
              onRefresh={onRefresh}
              onUpdateProgress={onUpdateProgress}
            />
          ))}
          
          {childItems.length === 0 && (
            <div className="text-sm text-gray-500 py-2 px-4 pl-12" style={{ paddingLeft: `${(level + 2) * 16 + 24}px` }}>
              No child items found. Click the + button to add one.
            </div>
          )}
        </div>
      )}
      
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the WBS item "{item.name}" and all its children. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteWbsItem.mutate()}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteWbsItem.isPending ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <Dialog open={isProgressDialogOpen} onOpenChange={setIsProgressDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Update Progress</DialogTitle>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="progress">Progress Percentage</Label>
              <Input
                id="progress"
                type="number"
                min="0"
                max="100"
                value={progress}
                onChange={(e) => setProgress(Number(e.target.value))}
              />
            </div>
            
            {/* Only show date fields for Activity items */}
            {item.type === "Activity" && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="actual-start-date">Actual Start Date</Label>
                  <DatePicker
                    date={actualStartDate}
                    setDate={setActualStartDate}
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="actual-end-date">Actual End Date</Label>
                  <DatePicker
                    date={actualEndDate}
                    setDate={setActualEndDate}
                    disabledDates={(date: Date): boolean => {
                      return actualStartDate ? date < actualStartDate : false;
                    }}
                  />
                </div>
              </>
            )}
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsProgressDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              onClick={handleProgressSubmit}
              disabled={updateProgress.isPending}
            >
              {updateProgress.isPending && (
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
