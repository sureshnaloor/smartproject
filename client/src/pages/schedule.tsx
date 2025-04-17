import { useParams } from "wouter";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { WbsItem, Dependency, InsertDependency } from "@shared/schema";
import { Link, ArrowRight, PlusCircle, X, ArrowRightCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { GanttChart } from "@/components/project/gantt-chart";
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

export default function Schedule() {
  const params = useParams();
  const projectId = parseInt(params.projectId);
  const [isAddDependencyModalOpen, setIsAddDependencyModalOpen] = useState(false);
  const [predecessorId, setPredecessorId] = useState<number | null>(null);
  const [successorId, setSuccessorId] = useState<number | null>(null);
  const [dependencyType, setDependencyType] = useState<string>("FS");
  const [lag, setLag] = useState<number>(0);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch WBS items for the project
  const { data: wbsItems = [], isLoading: isLoadingWbs } = useQuery<WbsItem[]>({
    queryKey: [`/api/projects/${projectId}/wbs`],
  });

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

  // Define columns for dependency table
  const columns: ColumnDef<Dependency>[] = [
    {
      accessorKey: "predecessorId",
      header: "Predecessor",
      cell: ({ row }) => {
        const predecessorId = row.getValue("predecessorId") as number;
        const predecessor = wbsItems.find(item => item.id === predecessorId);
        return (
          <div className="font-medium">
            {predecessor ? (
              <div className="flex flex-col">
                <span>{predecessor.name}</span>
                <span className="text-xs text-gray-500">Code: {predecessor.code}</span>
              </div>
            ) : (
              "Unknown Item"
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => {
        const type = row.getValue("type") as string;
        let description = "";
        if (type === "FS") description = "Finish to Start";
        else if (type === "SS") description = "Start to Start";
        else if (type === "FF") description = "Finish to Finish";
        else if (type === "SF") description = "Start to Finish";
        
        return (
          <Badge variant="outline">
            {type} <span className="ml-1 text-xs text-gray-500">({description})</span>
          </Badge>
        );
      },
    },
    {
      accessorKey: "lag",
      header: "Lag (days)",
      cell: ({ row }) => {
        const lag = row.getValue("lag") as number;
        return lag || "0";
      },
    },
    {
      accessorKey: "successorId",
      header: "Successor",
      cell: ({ row }) => {
        const successorId = row.getValue("successorId") as number;
        const successor = wbsItems.find(item => item.id === successorId);
        return (
          <div className="font-medium">
            {successor ? (
              <div className="flex flex-col">
                <span>{successor.name}</span>
                <span className="text-xs text-gray-500">Code: {successor.code}</span>
              </div>
            ) : (
              "Unknown Item"
            )}
          </div>
        );
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const predecessorId = row.getValue("predecessorId") as number;
        const successorId = row.getValue("successorId") as number;
        
        return (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-red-500"
            onClick={() => handleDeleteDependency(predecessorId, successorId)}
            disabled={deleteDependency.isPending}
          >
            <X className="h-4 w-4" />
          </Button>
        );
      },
    },
  ];

  return (
    <div className="flex-1 overflow-auto p-4 bg-gray-50 space-y-6">
      {/* Schedule Chart Section */}
      <GanttChart projectId={projectId} />
      
      {/* Dependencies Section */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center">
            <CardTitle>Activity Dependencies</CardTitle>
            <Button onClick={() => setIsAddDependencyModalOpen(true)}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Dependency
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable 
            columns={columns} 
            data={dependencies}
            pageSize={5}
          />
        </CardContent>
      </Card>

      {/* Add Dependency Modal */}
      <Dialog open={isAddDependencyModalOpen} onOpenChange={setIsAddDependencyModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Dependency</DialogTitle>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Predecessor Activity</label>
              <Select
                value={predecessorId?.toString() || ""}
                onValueChange={(value) => setPredecessorId(parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select predecessor" />
                </SelectTrigger>
                <SelectContent>
                  {wbsItems
                    .filter(item => item.type !== "Summary") // Typically dependencies are between activities/tasks
                    .map((item) => (
                      <SelectItem key={`pred-${item.id}`} value={item.id.toString()}>
                        {item.code} - {item.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center justify-center">
              <div className="flex flex-col items-center">
                <ArrowRightCircle className="h-6 w-6 text-gray-400 mb-1" />
                <div className="flex gap-2 items-center">
                  <Select
                    value={dependencyType}
                    onValueChange={setDependencyType}
                  >
                    <SelectTrigger className="w-[80px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FS">FS</SelectItem>
                      <SelectItem value="SS">SS</SelectItem>
                      <SelectItem value="FF">FF</SelectItem>
                      <SelectItem value="SF">SF</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <div className="flex items-center">
                    <span className="text-sm mr-2">Lag:</span>
                    <input
                      type="number"
                      value={lag}
                      onChange={(e) => setLag(parseInt(e.target.value) || 0)}
                      className="w-16 px-2 py-1 border rounded-md"
                      min="0"
                    />
                    <span className="text-sm ml-1">days</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="grid gap-2">
              <label className="text-sm font-medium">Successor Activity</label>
              <Select
                value={successorId?.toString() || ""}
                onValueChange={(value) => setSuccessorId(parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select successor" />
                </SelectTrigger>
                <SelectContent>
                  {wbsItems
                    .filter(item => item.type !== "Summary") // Typically dependencies are between activities/tasks
                    .map((item) => (
                      <SelectItem key={`succ-${item.id}`} value={item.id.toString()}>
                        {item.code} - {item.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="text-sm text-gray-500">
              <p><strong>FS (Finish-to-Start):</strong> Successor can't start until predecessor finishes</p>
              <p><strong>SS (Start-to-Start):</strong> Successor can't start until predecessor starts</p>
              <p><strong>FF (Finish-to-Finish):</strong> Successor can't finish until predecessor finishes</p>
              <p><strong>SF (Start-to-Finish):</strong> Successor can't finish until predecessor starts</p>
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddDependencyModalOpen(false);
                resetDependencyForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddDependency}
              disabled={createDependency.isPending || !predecessorId || !successorId}
            >
              {createDependency.isPending ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Adding...
                </>
              ) : (
                'Add Dependency'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
