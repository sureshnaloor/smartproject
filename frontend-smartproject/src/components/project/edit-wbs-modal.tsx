import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { insertWbsItemSchema, WbsItem } from "@/types";
import { calculateDuration, isValidDate, formatCurrency, formatDate } from "@/lib/utils";
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
import { Label } from "@/components/ui/label";

interface EditWbsModalProps {
  wbsItemId: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function EditWbsModal({ wbsItemId, isOpen, onClose, onSuccess }: EditWbsModalProps) {
  const [showDuration, setShowDuration] = useState(true);
  const [allowedTypes, setAllowedTypes] = useState<string[]>(["Summary"]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch the WBS item being edited
  const { data: wbsItem, isLoading: isLoadingWbsItem } = useQuery<WbsItem>({
    queryKey: [`/api/wbs/${wbsItemId}`],
    enabled: isOpen && wbsItemId > 0,
  });

  // Fetch all WBS items for the project to use as parent options
  const { data: wbsItems = [] } = useQuery<WbsItem[]>({
    queryKey: wbsItem ? [`/api/projects/${wbsItem.projectId}/wbs`] : [],
    enabled: isOpen && !!wbsItem,
  });

  // Get potential parent WBS item
  const parentItem = wbsItem?.parentId ? wbsItems.find(item => item.id === wbsItem.parentId) : null;

  // Form definition
  const form = useForm<WbsItem>({
    resolver: zodResolver(insertWbsItemSchema),
    defaultValues: {
      projectId: wbsItem?.projectId || 0,
      parentId: wbsItem?.parentId || null,
      name: "",
      description: "",
      level: wbsItem?.level || 1,
      code: "",
      type: "Summary",
      budgetedCost: 0,
      startDate: new Date(),
      endDate: new Date(new Date().setDate(new Date().getDate() + 7)),
      duration: 7,
      isTopLevel: false,
    },
  });

  // Initialize form with WBS item data when loaded
  useEffect(() => {
    if (wbsItem) {
      form.reset({
        projectId: wbsItem.projectId,
        parentId: wbsItem.parentId,
        name: wbsItem.name,
        description: wbsItem.description || "",
        level: wbsItem.level,
        code: wbsItem.code,
        type: wbsItem.type as "Summary" | "WorkPackage" | "Activity",
        budgetedCost: Number(wbsItem.budgetedCost),
        // Only set dates for Activity type, otherwise set to undefined
        startDate: wbsItem.type === "Activity" && wbsItem.startDate ? new Date(wbsItem.startDate) : undefined,
        endDate: wbsItem.type === "Activity" && wbsItem.endDate ? new Date(wbsItem.endDate) : undefined,
        duration: wbsItem.type === "Activity" ? wbsItem.duration || undefined : undefined,
        isTopLevel: wbsItem.isTopLevel,
      });
    }
  }, [wbsItem, form]);

  // Update allowed types when parent changes
  useEffect(() => {
    if (!wbsItem) return;
    
    let newAllowedTypes: string[] = ["Summary"];
    
    if (!wbsItem.parentId) {
      // Top-level items can only be Summary
      newAllowedTypes = ["Summary"];
    } else if (parentItem?.type === "Summary") {
      // Under Summary, can ONLY be WorkPackage
      newAllowedTypes = ["WorkPackage"];
    } else if (parentItem?.type === "WorkPackage") {
      // Under WorkPackage, can only be Activity
      newAllowedTypes = ["Activity"];
    }
    
    setAllowedTypes(newAllowedTypes);
    
  }, [wbsItem, parentItem]);

  // Get form values
  const { startDate, endDate, duration, type } = form.watch();

  // Update form fields based on WBS type
  useEffect(() => {
    if (type === "Summary" || type === "WorkPackage") {
      // For Summary and WorkPackage: set date fields to undefined
      form.setValue("startDate", undefined);
      form.setValue("endDate", undefined);
      form.setValue("duration", undefined);
      
      // For WorkPackage, check if parent budget needs to be considered
      if (type === "WorkPackage" && parentItem) {
        // Set max budget to parent's budget
        const maxBudget = Number(parentItem.budgetedCost) || 0;
        // If current budget exceeds parent budget, cap it
        const currentBudget = form.getValues("budgetedCost") || 0;
        if (currentBudget > maxBudget) {
          form.setValue("budgetedCost", maxBudget);
        }
      }
    } else if (type === "Activity") {
      // For Activity: has dates but no budget
      form.setValue("budgetedCost", 0);
      
      // Set default dates if they're undefined
      if (!form.getValues("startDate")) {
        form.setValue("startDate", new Date());
      }
      if (!form.getValues("endDate")) {
        const newEndDate = new Date();
        newEndDate.setDate(newEndDate.getDate() + 7);
        form.setValue("endDate", newEndDate);
      }
      if (!form.getValues("duration")) {
        form.setValue("duration", 7);
      }
    }
  }, [type, form, parentItem]);

  // Update dates and duration when one changes
  const updateDatesAndDuration = (field: 'startDate' | 'endDate' | 'duration', value: any) => {
    if (field === 'startDate' && endDate) {
      // Calculate new duration based on the date range
      const startDate = value;
      const endDateObj = new Date(endDate);
      const newDuration = calculateDuration(startDate, endDateObj);
      
      // Update form values
      form.setValue('duration', newDuration);
      form.setValue(field, value); // Store as Date object
    } 
    else if (field === 'endDate' && startDate) {
      // Calculate new duration based on the date range
      const startDateObj = new Date(startDate);
      const endDate = value;
      const newDuration = calculateDuration(startDateObj, endDate);
      
      // Update form values
      form.setValue('duration', newDuration);
      form.setValue(field, value); // Store as Date object
    }
    else if (field === 'duration' && startDate) {
      // Calculate new end date based on start date and duration
      const startDateObj = new Date(startDate);
      const newEndDate = new Date(startDateObj);
      newEndDate.setDate(newEndDate.getDate() + Number(value) - 1);
      
      // Update form values
      form.setValue('endDate', newEndDate); // Store as Date object
      form.setValue(field, Number(value));
    }
  };

  // Calculate remaining budget for parent
  const getRemainingParentBudget = (): number => {
    if (!wbsItem?.parentId || !parentItem || parentItem.type !== 'Summary' || wbsItem.type !== 'WorkPackage') {
      return 0;
    }
    
    // For a WorkPackage, calculate how much budget is left on the parent Summary
    const totalParentBudget = Number(parentItem.budgetedCost) || 0;
    
    // Find all other WorkPackage siblings
    const siblings = wbsItems.filter(item => 
      item.parentId === wbsItem.parentId && 
      item.type === 'WorkPackage' &&
      item.id !== wbsItemId  // Exclude the current item
    );
    
    // Sum up other sibling budgets
    const usedBudget = siblings.reduce((total, sibling) => {
      return total + Number(sibling.budgetedCost || 0);
    }, 0);
    
    return totalParentBudget - usedBudget;
  };

  const remainingBudget = getRemainingParentBudget();
  
  // Get maximum allowable budget (remaining + current item's budget)
  const getMaxBudget = (): number => {
    if (!wbsItem || wbsItem.type !== 'WorkPackage') return 0;
    return remainingBudget + Number(wbsItem.budgetedCost);
  };

  // Update WBS item mutation
  const updateWbsItem = useMutation({
    mutationFn: async (data: Partial<WbsItem>) => {
      const response = await apiRequest("PUT", `/api/wbs/${wbsItemId}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${wbsItem?.projectId}/wbs`] });
      queryClient.invalidateQueries({ queryKey: [`/api/wbs/${wbsItemId}`] });
      toast({
        title: "WBS Item Updated",
        description: "The WBS item has been updated successfully.",
        variant: "default",
      });
      if (onSuccess) onSuccess();
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update WBS item. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Form submission handler
  const onSubmit = (data: WbsItem) => {
    // We don't want to update certain fields that shouldn't change
    const { projectId, code, level, isTopLevel, ...updateData } = data;
    
    // For Summary and WorkPackage types, remove date fields as they should be null
    if (updateData.type === "Summary" || updateData.type === "WorkPackage") {
      const { startDate, endDate, duration, ...nonActivityData } = updateData;
      updateWbsItem.mutate(nonActivityData);
    } else {
      // For Activity types, include all fields
      updateWbsItem.mutate(updateData);
    }
  };

  if (isLoadingWbsItem) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit WBS Item</DialogTitle>
          </DialogHeader>
          <div className="py-6">Loading WBS item data...</div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!wbsItem) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit WBS Item</DialogTitle>
          </DialogHeader>
          <div className="py-6 text-red-500">WBS item not found</div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit WBS Item</DialogTitle>
          <DialogDescription>
            Update the details of this work breakdown structure item.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>WBS Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter WBS name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>WBS Type</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={wbsItem.isTopLevel || allowedTypes.length <= 1}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a type" />
                      </SelectTrigger>
                      <SelectContent>
                        {allowedTypes.includes("Summary") && (
                          <SelectItem value="Summary">Summary</SelectItem>
                        )}
                        {allowedTypes.includes("WorkPackage") && (
                          <SelectItem value="WorkPackage">Work Package</SelectItem>
                        )}
                        {allowedTypes.includes("Activity") && (
                          <SelectItem value="Activity">Activity</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {wbsItem.isTopLevel ? 
                        "Top-level items must be Summary type" : 
                        parentItem?.type === "WorkPackage" ? 
                          "WorkPackage items can only have Activity children" :
                          "Summary items can have Summary or WorkPackage children"
                      }
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>WBS Code</FormLabel>
                    <FormControl>
                      <Input {...field} readOnly />
                    </FormControl>
                    <FormDescription>
                      WBS code cannot be changed
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="budgetedCost"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Budgeted Cost ($)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number"
                      step="0.01"
                      min="0"
                      max={type === "WorkPackage" && parentItem ? Number(parentItem.budgetedCost) : undefined}
                      placeholder="0.00"
                      {...field}
                      value={field.value || 0}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value);
                        // For WorkPackage, ensure budget doesn't exceed maximum allowed
                        if (type === "WorkPackage" && parentItem) {
                          const maxAllowed = getMaxBudget();
                          if (value > maxAllowed) {
                            field.onChange(maxAllowed);
                            toast({
                              title: "Budget limit reached",
                              description: `Work package budget cannot exceed available budget of ${formatCurrency(maxAllowed)}`,
                              variant: "destructive",
                            });
                          } else {
                            field.onChange(value);
                          }
                        } else {
                          field.onChange(value);
                        }
                      }}
                      disabled={type === "Activity"}
                    />
                  </FormControl>
                  <FormDescription>
                    {type === "Activity" ? 
                      "Activity items cannot have a budget" : 
                      type === "WorkPackage" && parentItem ? 
                        `Available budget: ${formatCurrency(getMaxBudget())} (parent total: ${formatCurrency(parentItem.budgetedCost)})` :
                        "Budget for this work item"
                    }
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Only show date fields for Activity type */}
            {type === "Activity" && (
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
                              updateDatesAndDuration('startDate', date);
                            }
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {showDuration ? (
                  <FormField
                    control={form.control}
                    name="duration"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Duration (days)
                          <Button
                            type="button"
                            variant="link"
                            className="ml-2 p-0 h-auto text-xs"
                            onClick={() => setShowDuration(false)}
                          >
                            Switch to End Date
                          </Button>
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            placeholder="1"
                            {...field}
                            value={field.value || 0}
                            onChange={(e) => {
                              const value = parseInt(e.target.value);
                              if (!isNaN(value) && value > 0) {
                                updateDatesAndDuration('duration', value);
                              }
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : (
                  <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          End Date
                          <Button
                            type="button"
                            variant="link"
                            className="ml-2 p-0 h-auto text-xs"
                            onClick={() => setShowDuration(true)}
                          >
                            Switch to Duration
                          </Button>
                        </FormLabel>
                        <FormControl>
                          <DatePicker
                            date={field.value}
                            setDate={(date) => {
                              if (date) {
                                updateDatesAndDuration('endDate', date);
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
                )}
              </div>
            )}

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Optional description"
                      rows={3}
                      value={field.value || ""}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      ref={field.ref}
                      name={field.name}
                      disabled={field.disabled}
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
                disabled={updateWbsItem.isPending}
              >
                {updateWbsItem.isPending && (
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                Update WBS Item
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
} 