import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { insertProjectSchema, Project, WbsItem } from "@/types";
import { useToast } from "@/hooks/use-toast";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";

interface EditProjectModalProps {
  projectId: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function EditProjectModal({ projectId, isOpen, onClose, onSuccess }: EditProjectModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showDuration, setShowDuration] = useState(false);

  // Fetch project data
  const { data: project, isLoading } = useQuery<Project>({
    queryKey: [`/api/projects/${projectId}`],
    enabled: isOpen && projectId > 0,
  });

  // Fetch WBS items to determine if currency can be edited
  const { data: wbsItems = [] } = useQuery<WbsItem[]>({
    queryKey: [`/api/projects/${projectId}/wbs`],
    enabled: isOpen && projectId > 0,
  });

  // Determine if currency can be edited (only if there are no WBS items yet)
  const canEditCurrency = wbsItems.length === 0;
  
  // Determine if budget can be edited (only if there are only the 3 default WBS items)
  const hasOnlyDefaultWbs = wbsItems.length === 3 && 
    wbsItems.every(item => item.isTopLevel) &&
    wbsItems.every(item => item.parentId === null);
  
  const canEditBudget = hasOnlyDefaultWbs || wbsItems.length === 0;

  // Form definition
  const form = useForm<Project>({
    resolver: zodResolver(insertProjectSchema),
    defaultValues: {
      name: "",
      description: "",
      budget: 0,
      startDate: new Date(),
      endDate: new Date(new Date().setMonth(new Date().getMonth() + 6)),
      currency: "USD",
    },
  });

  // Initialize form with project data when loaded
  useEffect(() => {
    if (project) {
      form.reset({
        name: project.name,
        description: project.description || "",
        budget: Number(project.budget),
        startDate: new Date(project.startDate),
        endDate: new Date(project.endDate),
        currency: project.currency || "USD",
      });
    }
  }, [project, form]);

  // Get form values
  const { startDate, endDate } = form.watch();

  // Update dates and duration when one changes
  const updateEndDate = (newStartDate: Date) => {
    const currentEndDate = form.getValues("endDate");
    if (currentEndDate && newStartDate > new Date(currentEndDate)) {
      // If new start date is after current end date, set end date to start date + 1 month
      const newEndDate = new Date(newStartDate);
      newEndDate.setMonth(newEndDate.getMonth() + 1);
      form.setValue("endDate", newEndDate);
    }
  };

  // Update project mutation
  const updateProject = useMutation({
    mutationFn: async (data: Project) => {
      const response = await apiRequest("PATCH", `/api/projects/${projectId}`, data);
      return response.json();
    },
    onSuccess: () => {
      // Invalidate all project-related queries
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}`] });
      
      // Invalidate WBS queries as they might show aggregated budget/cost data
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/wbs`] });
      
      // Force refetch of all tabs data
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/costs`] });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/schedule`] });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/reports`] });
      
      toast({
        title: "Project Updated",
        description: "The project has been updated successfully.",
        variant: "default",
      });
      if (onSuccess) onSuccess();
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update project. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Form submission handler
  const onSubmit = (data: Project) => {
    updateProject.mutate(data);
  };

  if (isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            Loading project data...
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Project</DialogTitle>
          <DialogDescription>
            Update the details of this construction project.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter project name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="budget"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Budget</FormLabel>
                    <FormControl>
                      <Input 
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        {...field}
                        value={field.value}
                        onChange={(e) => field.onChange(parseFloat(e.target.value))}
                        disabled={!canEditBudget}
                      />
                    </FormControl>
                    <FormDescription>
                      {!canEditBudget && "Budget cannot be changed after custom WBS items have been added."}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Currency</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                      disabled={!canEditCurrency}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="USD">USD ($)</SelectItem>
                        <SelectItem value="EUR">EUR (€)</SelectItem>
                        <SelectItem value="SAR">SAR (﷼)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {!canEditCurrency && "Currency cannot be changed after WBS items are added."}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date</FormLabel>
                    <FormControl>
                      <DatePicker
                        date={field.value}
                        setDate={(date) => {
                          if (date) {
                            field.onChange(date);
                            updateEndDate(date);
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Date</FormLabel>
                    <FormControl>
                      <DatePicker
                        date={field.value}
                        setDate={(date) => {
                          if (date) {
                            field.onChange(date);
                          }
                        }}
                        disabledDates={(date: Date): boolean => {
                          return startDate ? date < startDate : false;
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Optional project description"
                      rows={3}
                      {...field}
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={updateProject.isPending}
              >
                {updateProject.isPending && (
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                Update Project
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
} 