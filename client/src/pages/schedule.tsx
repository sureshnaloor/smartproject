import { useParams } from "wouter";
import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { WbsItem, Dependency, InsertDependency } from "@shared/schema";
import { Link, ArrowRight, PlusCircle, X, ArrowRightCircle, CalendarClock, ImportIcon, ListTodo, FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { GanttChart } from "@/components/project/gantt-chart";
import { AddWbsModal } from "@/components/project/add-wbs-modal";
import { ImportActivityModal } from "@/components/project/import-activity-modal";
import { ImportTaskModal } from "@/components/project/import-task-modal";
import { AddTaskModal } from "@/components/project/add-task-modal";
import { formatDate, formatShortDate, isValidDependency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ColumnDef } from "@tanstack/react-table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Define a Task interface
interface Task {
  id?: number;
  activityId: number;
  projectId?: number;
  name: string;
  description?: string;
  startDate?: string | null;
  endDate?: string | null;
  duration?: number;
  percentComplete?: number;
  dependencies?: { predecessorId: number; successorId: number; type: string; lag: number }[];
}

export default function Schedule() {
  const params = useParams<{ projectId: string }>();
  const projectId = parseInt(params.projectId || "0");
  const [activeTab, setActiveTab] = useState<string>("schedule");
  const [isAddDependencyModalOpen, setIsAddDependencyModalOpen] = useState(false);
  const [isAddActivityModalOpen, setIsAddActivityModalOpen] = useState(false);
  const [isImportTasksModalOpen, setIsImportTasksModalOpen] = useState(false);
  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);
  const [selectedParentId, setSelectedParentId] = useState<number | null>(null);
  const [predecessorId, setPredecessorId] = useState<number | null>(null);
  const [successorId, setSuccessorId] = useState<number | null>(null);
  const [dependencyType, setDependencyType] = useState<string>("FS");
  const [lag, setLag] = useState<number>(0);
  const debuggedItems = useRef(false);
  const [isProcessingSchedule, setIsProcessingSchedule] = useState(false);
  const [selectedActivityId, setSelectedActivityId] = useState<number | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch WBS items for the project
  const { data: wbsItems = [], isLoading: isLoadingWbs } = useQuery<WbsItem[]>({
    queryKey: [`/api/projects/${projectId}/wbs`],
  });

  // Fetch tasks for the project
  const { data: taskData = [], isLoading: isLoadingTasks } = useQuery<Task[]>({
    queryKey: [`/api/projects/${projectId}/tasks`],
    enabled: projectId > 0,
  });

  // Update the local tasks state when taskData changes
  useEffect(() => {
    setTasks(taskData);
  }, [taskData]);

  // Find work package items (use a Set to ensure uniqueness by ID)
  const workPackageItems = useMemo(() => {
    const uniqueIds = new Set<number>();
    return wbsItems
      .filter(item => {
        if (item.type === "WorkPackage" && !uniqueIds.has(item.id)) {
          uniqueIds.add(item.id);
          return true;
        }
        return false;
      });
  }, [wbsItems]);

  // DEBUG: Check for duplicate items by ID, but only once per data change
  useEffect(() => {
    // Skip if we've already debugged this set of items
    if (debuggedItems.current) return;
    
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
      console.warn('Duplicate WBS items detected in schedule.tsx:', duplicates);
    }
    
    // Mark as debugged to prevent further checks on the same data
    debuggedItems.current = true;
    
    // Reset debugged flag when component unmounts
    return () => {
      debuggedItems.current = false;
    };
  }, [wbsItems]);

  // Fetch dependencies
  const fetchDependenciesForItems = async () => {
    // Skip if no WBS items
    if (!wbsItems.length) return [];
    
    try {
      // Try to fetch all dependencies for the project at once
      const response = await fetch(`/api/projects/${projectId}/dependencies`, {
        credentials: "include",
      });
      
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error("Error fetching all dependencies:", error);
    }
    
    // Fallback to fetching by activity if project-wide endpoint doesn't exist
    const allDependencies: Dependency[] = [];
    const activityItems = wbsItems.filter(item => item.type === "Activity");
    
    for (const item of activityItems) {
      try {
        const response = await fetch(`/api/wbs/${item.id}/dependencies`, {
          credentials: "include",
        });
        if (response.ok) {
          const deps = await response.json();
          allDependencies.push(...deps);
        }
      } catch (error) {
        console.error(`Error fetching dependencies for item ${item.id}:`, error);
      }
    }
    
    // Deduplicate dependencies
    const uniqueDependenciesSet = new Set<string>();
    const uniqueDependencies: Dependency[] = [];
    
    allDependencies.forEach(dep => {
      const depString = `${dep.predecessorId}-${dep.successorId}`;
      if (!uniqueDependenciesSet.has(depString)) {
        uniqueDependenciesSet.add(depString);
        uniqueDependencies.push(dep);
      }
    });
    
    return uniqueDependencies;
  };

  const { data: dependencies = [], isLoading: isLoadingDeps } = useQuery<Dependency[]>({
    queryKey: [`/api/projects/${projectId}/dependencies`],
    queryFn: fetchDependenciesForItems,
    enabled: wbsItems.length > 0,
  });

  // Create dependency mutation
  const createDependency = useMutation({
    mutationFn: async (data: InsertDependency) => {
      const response = await apiRequest("POST", "/api/dependencies", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/dependencies`] });
      toast({
        title: "Dependency Created",
        description: "The dependency has been created successfully.",
        variant: "default",
      });
      setIsAddDependencyModalOpen(false);
      resetDependencyForm();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create dependency. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete dependency mutation
  const deleteDependency = useMutation({
    mutationFn: async ({ predecessorId, successorId }: { predecessorId: number; successorId: number }) => {
      const response = await apiRequest("DELETE", `/api/dependencies/${predecessorId}/${successorId}`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/dependencies`] });
      toast({
        title: "Dependency Deleted",
        description: "The dependency has been deleted successfully.",
        variant: "default",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete dependency. Please try again.",
        variant: "destructive",
      });
    },
  });

  const resetDependencyForm = () => {
    setPredecessorId(null);
    setSuccessorId(null);
    setDependencyType("FS");
    setLag(0);
  };

  const handleAddDependency = () => {
    if (!predecessorId || !successorId) {
      toast({
        title: "Validation Error",
        description: "Please select both predecessor and successor items.",
        variant: "destructive",
      });
      return;
    }

    if (predecessorId === successorId) {
      toast({
        title: "Validation Error",
        description: "A WBS item cannot depend on itself.",
        variant: "destructive",
      });
      return;
    }

    // Check if dependency already exists
    const existingDependency = dependencies.find(
      dep => dep.predecessorId === predecessorId && dep.successorId === successorId
    );

    if (existingDependency) {
      toast({
        title: "Validation Error",
        description: "This dependency already exists.",
        variant: "destructive",
      });
      return;
    }

    // Check for circular dependencies
    if (!isValidDependency(predecessorId, successorId, wbsItems, dependencies)) {
      toast({
        title: "Validation Error",
        description: "This would create a circular dependency and is not allowed.",
        variant: "destructive",
      });
      return;
    }

    createDependency.mutate({
      predecessorId,
      successorId,
      type: dependencyType,
      lag
    });
  };

  const handleDeleteDependency = (predecessorId: number, successorId: number) => {
    deleteDependency.mutate({ predecessorId, successorId });
  };

  const handleAddActivity = (parentId: number) => {
    setSelectedParentId(parentId);
    setIsAddActivityModalOpen(true);
  };

  // Add finalize schedule mutation
  const finalizeSchedule = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/projects/${projectId}/schedule/finalize`);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/wbs`] });
      toast({
        title: "Schedule Finalized",
        description: `${data.updatedCount} activities have been updated based on dependencies.`,
        variant: "default",
      });
      
      if (data.errorCount > 0) {
        console.error("Errors during schedule finalization:", data.errors);
        toast({
          title: "Some Updates Failed",
          description: `${data.errorCount} activities could not be updated. Check console for details.`,
          variant: "destructive",
        });
      }
      
      setIsProcessingSchedule(false);
    },
    onError: (error) => {
      setIsProcessingSchedule(false);
      toast({
        title: "Error",
        description: error.message || "Failed to finalize schedule. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleFinalizeSchedule = () => {
    if (dependencies.length === 0) {
      toast({
        title: "No Dependencies",
        description: "There are no dependencies to process. Add dependencies before finalizing the schedule.",
        variant: "default",
      });
      return;
    }
    
    setIsProcessingSchedule(true);
    finalizeSchedule.mutate();
  };

  // Handle adding a task to an activity
  const handleAddTask = (activityId: number) => {
    setSelectedActivityId(activityId);
    setIsAddTaskModalOpen(true);
  };

  // Create task mutation
  const createTask = useMutation({
    mutationFn: async (task: Task) => {
      const response = await apiRequest("POST", "/api/tasks", task);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create task");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/tasks`] });
      toast({
        title: "Task Created",
        description: "The task has been created successfully.",
        variant: "default",
      });
    },
    onError: (error: Error) => {
      console.error("Task creation error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create task. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleCreateTask = (task: Task) => {
    console.log("Handling create task:", task);
    
    // Create a clean task object to avoid any unwanted properties
    const taskToCreate: Task = {
      activityId: task.activityId,
      projectId: task.projectId || projectId,
      name: task.name,
      description: task.description || "",
      percentComplete: task.percentComplete || 0,
    };
    
    // Only add startDate if it exists
    if (task.startDate) {
      taskToCreate.startDate = task.startDate;
    }
    
    // Only add one of endDate or duration, not both
    if (task.endDate) {
      taskToCreate.endDate = task.endDate;
    } else if (task.duration) {
      taskToCreate.duration = task.duration;
    } else if (task.startDate) {
      // If we have a startDate but neither endDate nor duration, add a default duration
      taskToCreate.duration = 1; // Default to 1 day
    }
    
    console.log("Sending task to API:", taskToCreate);
    createTask.mutate(taskToCreate);
    setIsAddTaskModalOpen(false);
  };

  // Import tasks mutation
  const importTasks = useMutation({
    mutationFn: async (tasks: Task[]) => {
      const response = await apiRequest("POST", "/api/tasks/bulk", tasks);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/tasks`] });
      toast({
        title: "Tasks Imported",
        description: `${data.length} tasks have been imported successfully.`,
        variant: "default",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to import tasks. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleImportTasks = (importedTasks: Task[]) => {
    // Process each task to ensure proper formatting, similar to handleCreateTask
    const processedTasks = importedTasks.map(task => {
      // Create a clean task object for each imported task
      const processedTask: Task = {
        activityId: task.activityId,
        name: task.name,
        description: task.description || "",
        percentComplete: task.percentComplete || 0
      };
      
      // Set projectId from the activity if available
      const activity = wbsItems.find(a => a.id === task.activityId);
      if (activity) {
        processedTask.projectId = activity.projectId;
      } else {
        processedTask.projectId = projectId; // Fall back to current project ID
      }
      
      // Only add startDate if it exists
      if (task.startDate) {
        processedTask.startDate = task.startDate;
      }
      
      // Only add one of endDate or duration, not both
      if (task.endDate) {
        processedTask.endDate = task.endDate;
      } else if (task.duration) {
        processedTask.duration = task.duration;
      }
      
      console.log("Processed task for import:", processedTask);
      return processedTask;
    });
    
    // Send the processed tasks to the API
    console.log("Importing tasks:", processedTasks);
    importTasks.mutate(processedTasks);
  };

  // Define task table columns
  const taskColumns: ColumnDef<Task>[] = [
    {
      accessorKey: "name",
      header: "Task Name",
    },
    {
      accessorKey: "activityId",
      header: "Activity",
      cell: ({ row }) => {
        const activityId = row.getValue("activityId") as number;
        const activity = wbsItems.find(item => item.id === activityId);
        return activity?.name || `Activity #${activityId}`;
      },
    },
    {
      accessorKey: "startDate",
      header: "Start Date",
      cell: ({ row }) => {
        const startDate = row.getValue("startDate") as string | null;
        return startDate ? formatDate(new Date(startDate)) : "-";
      },
    },
    {
      accessorKey: "endDate",
      header: "End Date",
      cell: ({ row }) => {
        const endDate = row.getValue("endDate") as string | null;
        return endDate ? formatDate(new Date(endDate)) : "-";
      },
    },
    {
      accessorKey: "duration",
      header: "Duration (days)",
      cell: ({ row }) => {
        const duration = row.getValue("duration") as number | undefined;
        return duration !== undefined ? duration : "-";
      },
    },
    {
      accessorKey: "percentComplete",
      header: "Progress",
      cell: ({ row }) => {
        const progress = row.getValue("percentComplete") as number;
        return progress !== undefined ? `${progress}%` : "0%";
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const task = row.original;
        return (
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDeleteTask(task.id!)}
            >
              <X className="h-4 w-4 text-red-500" />
            </Button>
          </div>
        );
      },
    },
  ];

  // Delete task mutation
  const deleteTask = useMutation({
    mutationFn: async (taskId: number) => {
      const response = await apiRequest("DELETE", `/api/tasks/${taskId}`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/tasks`] });
      toast({
        title: "Task Deleted",
        description: "The task has been deleted successfully.",
        variant: "default",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete task. Please try again.",
        variant: "destructive",
      });
    },
  });
  
  const handleDeleteTask = (taskId: number) => {
    if (confirm("Are you sure you want to delete this task?")) {
      deleteTask.mutate(taskId);
    }
  };

  return (
    <div className="flex-1 overflow-auto p-4 bg-gray-50">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">Project Schedule</h1>
          {isProcessingSchedule && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              <CalendarClock className="w-3 h-3 mr-1" />
              Processing
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => {
              setSelectedParentId(null);
              setIsAddActivityModalOpen(true);
            }}
            variant="outline"
            size="sm"
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Activity
          </Button>
          <Button onClick={handleFinalizeSchedule} size="sm">
            <ArrowRightCircle className="mr-2 h-4 w-4" />
            Calculate Schedule
          </Button>
        </div>
      </div>

      <Tabs defaultValue="schedule" value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="dependencies">Dependencies</TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
        </TabsList>

        <TabsContent value="schedule" className="space-y-4">
          <GanttChart 
            projectId={projectId} 
            onAddActivity={handleAddActivity}
            onAddTask={handleAddTask}
          />
        </TabsContent>

        <TabsContent value="dependencies" className="space-y-4">
          {/* Dependencies content here */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                <span>Activity Dependencies</span>
                <Button onClick={() => setIsAddDependencyModalOpen(true)} variant="outline" size="sm">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add Dependency
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Dependencies table */}
              <div className="rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="p-2 text-left font-medium">Predecessor</th>
                      <th className="p-2 text-left font-medium">Type</th>
                      <th className="p-2 text-left font-medium">Lag</th>
                      <th className="p-2 text-left font-medium">Successor</th>
                      <th className="p-2 text-center font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dependencies.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-4 text-center text-muted-foreground">
                          No dependencies created yet. Add some dependencies to see them here.
                        </td>
                      </tr>
                    ) : (
                      dependencies.map((dep) => {
                        const predecessor = wbsItems.find((item) => item.id === dep.predecessorId);
                        const successor = wbsItems.find((item) => item.id === dep.successorId);
                        
                        return (
                          <tr key={`${dep.predecessorId}-${dep.successorId}`} className="border-t">
                            <td className="p-2">{predecessor?.name || `Item #${dep.predecessorId}`}</td>
                            <td className="p-2">
                              <Badge variant="outline">{dep.type || "FS"}</Badge>
                            </td>
                            <td className="p-2">{dep.lag || 0} days</td>
                            <td className="p-2">{successor?.name || `Item #${dep.successorId}`}</td>
                            <td className="p-2 text-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteDependency(dep.predecessorId, dep.successorId)}
                              >
                                <X className="h-4 w-4 text-red-500" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resources" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                <span>Task Management</span>
                <div className="space-x-2">
                  <Button onClick={() => setIsImportTasksModalOpen(true)} variant="outline" size="sm">
                    <ImportIcon className="mr-2 h-4 w-4" />
                    Import Tasks
                  </Button>
                  <Button onClick={() => {
                    setSelectedActivityId(null);
                    setIsAddTaskModalOpen(true);
                  }} variant="default" size="sm">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Task
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {tasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <ListTodo className="h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Tasks Created</h3>
                  <p className="text-muted-foreground mb-4 max-w-md">
                    Tasks are the smallest unit of work assigned to resources. Create tasks for activities to track individual work items.
                  </p>
                  <div className="flex space-x-4">
                    <Button onClick={() => setIsAddTaskModalOpen(true)} variant="default">
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Add Task
                    </Button>
                    <Button onClick={() => setIsImportTasksModalOpen(true)} variant="outline">
                      <FileUp className="mr-2 h-4 w-4" />
                      Import from CSV
                    </Button>
                  </div>
                </div>
              ) : (
                <DataTable columns={taskColumns} data={tasks} />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Dependency Modal */}
      <Dialog open={isAddDependencyModalOpen} onOpenChange={setIsAddDependencyModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Dependency</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Predecessor</label>
              <Select value={predecessorId?.toString()} onValueChange={(value) => setPredecessorId(parseInt(value))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select predecessor" />
                </SelectTrigger>
                <SelectContent>
                  {wbsItems
                    .filter((item) => item.type === "Activity")
                    .map((item) => (
                      <SelectItem key={`pred-${item.id}`} value={item.id.toString()}>
                        {item.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Type</label>
                <Select value={dependencyType} onValueChange={setDependencyType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FS">Finish-to-Start (FS)</SelectItem>
                    <SelectItem value="SS">Start-to-Start (SS)</SelectItem>
                    <SelectItem value="FF">Finish-to-Finish (FF)</SelectItem>
                    <SelectItem value="SF">Start-to-Finish (SF)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Lag (days)</label>
                <input
                  type="number"
                  className="w-full rounded-md border border-input py-2 px-3"
                  value={lag}
                  onChange={(e) => setLag(parseInt(e.target.value) || 0)}
                  min={0}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Successor</label>
              <Select value={successorId?.toString()} onValueChange={(value) => setSuccessorId(parseInt(value))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select successor" />
                </SelectTrigger>
                <SelectContent>
                  {wbsItems
                    .filter((item) => item.type === "Activity" && item.id !== predecessorId)
                    .map((item) => (
                      <SelectItem key={`succ-${item.id}`} value={item.id.toString()}>
                        {item.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDependencyModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (predecessorId && successorId) {
                  createDependency.mutate({
                    predecessorId,
                    successorId,
                    type: dependencyType,
                    lag,
                  });
                }
              }}
              disabled={!predecessorId || !successorId || predecessorId === successorId}
            >
              Add Dependency
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Activity Modal */}
      <AddWbsModal
        isOpen={isAddActivityModalOpen}
        onClose={() => setIsAddActivityModalOpen(false)}
        projectId={projectId}
        parentId={selectedParentId}
        scheduleView={true}
      />

      {/* Add Task Modal */}
      <AddTaskModal
        isOpen={isAddTaskModalOpen}
        onClose={() => setIsAddTaskModalOpen(false)}
        onAdd={handleCreateTask}
        activities={wbsItems}
        selectedActivityId={selectedActivityId}
      />

      {/* Import Tasks Modal */}
      <ImportTaskModal
        isOpen={isImportTasksModalOpen}
        onClose={() => setIsImportTasksModalOpen(false)}
        onImport={handleImportTasks}
        activities={wbsItems}
      />
    </div>
  );
}
