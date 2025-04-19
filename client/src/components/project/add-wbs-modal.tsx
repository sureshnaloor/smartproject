import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { extendedInsertWbsItemSchema, InsertWbsItem, WbsItem } from "@shared/schema";
import { calculateDuration, isValidDate, formatCurrency } from "@/lib/utils";
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

interface AddWbsModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: number;
  parentId?: number | null;
  onSuccess?: () => void;
}

export function AddWbsModal({ isOpen, onClose, projectId, parentId = null, onSuccess }: AddWbsModalProps) {
  const [showDuration, setShowDuration] = useState(true);
  const [allowedTypes, setAllowedTypes] = useState<string[]>(["Summary"]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch WBS items for the project to use as parent options and predecessors
  const { data: wbsItems = [] } = useQuery<WbsItem[]>({
    queryKey: [`/api/projects/${projectId}/wbs`],
    enabled: isOpen,
  });

  // Get potential parent WBS item
  const parentItem = parentId ? wbsItems.find(item => item.id === parentId) : null;
  
  // Calculate the next code
  const calculateNextCode = () => {
    if (!parentId) {
      const topLevelItems = wbsItems.filter(item => !item.parentId);
      return `${topLevelItems.length + 1}`;
    }
    
    const siblings = wbsItems.filter(item => item.parentId === parentId);
    const parentCode = parentItem?.code || "";
    return `${parentCode}.${siblings.length + 1}`;
  };

  // Calculate the level based on parent
  const calculateLevel = () => {
    if (!parentId) return 1;
    return (parentItem?.level || 0) + 1;
  };

  // Calculate remaining budget for parent
  const getRemainingParentBudget = (): number => {
    if (!parentId || !parentItem || parentItem.type !== 'Summary') return 0;
    
    // For a WorkPackage, calculate how much budget is left on the parent Summary
    const totalParentBudget = Number(parentItem.budgetedCost) || 0;
    
    // Find all WorkPackage siblings
    const siblings = wbsItems.filter(item => 
      item.parentId === parentId && 
      item.type === 'WorkPackage'
    );
    
    // Sum up sibling budgets
    const usedBudget = siblings.reduce((total, sibling) => {
      return total + Number(sibling.budgetedCost || 0);
    }, 0);
    
    return totalParentBudget - usedBudget;
  };

  const remainingBudget = getRemainingParentBudget();

  // Form definition
  const form = useForm<InsertWbsItem>({
    resolver: zodResolver(extendedInsertWbsItemSchema),
    defaultValues: {
      projectId,
      parentId,
      name: "",
      description: "",
      level: calculateLevel(),
      code: calculateNextCode(),
      type: "Summary", // Default to Summary, will be updated in useEffect
      budgetedCost: 0,
      startDate: new Date(),
      endDate: new Date(new Date().setDate(new Date().getDate() + 7)),
      duration: 7,
      isTopLevel: !parentId,
    },
  });

  // Update allowed types when parent changes
  useEffect(() => {
    let newAllowedTypes: string[] = ["Summary"];
    
    if (!parentId) {
      // Top-level items can only be Summary
      newAllowedTypes = ["Summary"];
    } else if (parentItem?.type === "Summary") {
      // Under Summary, can ONLY be WorkPackage (no longer allowing Summary)
      newAllowedTypes = ["WorkPackage"];
    } else if (parentItem?.type === "WorkPackage") {
      // Under WorkPackage, can only be Activity
      newAllowedTypes = ["Activity"];
    }
    
    setAllowedTypes(newAllowedTypes);
    
    // Set default type based on parent
    if (!parentId) {
      form.setValue("type", "Summary");
    } else if (parentItem?.type === "Summary") {
      form.setValue("type", "WorkPackage");
      // Set default budget to remaining budget of parent if adding a WorkPackage
      if (remainingBudget > 0) {
        form.setValue("budgetedCost", remainingBudget);
      }
    } else if (parentItem?.type === "WorkPackage") {
      form.setValue("type", "Activity");
    }
    
  }, [parentId, parentItem, form, remainingBudget]);

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

  // Create WBS item mutation
  const createWbsItem = useMutation({
    mutationFn: async (data: InsertWbsItem) => {
      const response = await apiRequest("POST", "/api/wbs", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/wbs`] });
      toast({
        title: "WBS Item Created",
        description: "The WBS item has been created successfully.",
        variant: "default",
      });
      form.reset();
      if (onSuccess) onSuccess();
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create WBS item. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Form submission handler
  const onSubmit = (data: InsertWbsItem) => {
    // For Summary and WorkPackage types, remove date fields
    if (data.type === "Summary" || data.type === "WorkPackage") {
      const { startDate, endDate, duration, ...nonActivityData } = data;
      createWbsItem.mutate(nonActivityData);
    } else {
      // For Activity types, include all fields
      createWbsItem.mutate(data);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New WBS Item</DialogTitle>
          <DialogDescription>
            Create a new work breakdown structure item for your project.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="parentId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Parent WBS</FormLabel>
                  <Select
                    value={field.value?.toString() || "none"}
                    onValueChange={(value) => {
                      const newParentId = value === "none" ? null : parseInt(value);
                      field.onChange(newParentId);
                      
                      // Update level and code when parent changes
                      const parent = newParentId ? wbsItems.find(item => item.id === newParentId) : null;
                      const newLevel = parent ? parent.level + 1 : 1;
                      form.setValue("level", newLevel);
                      
                      // Calculate new code
                      const siblings = wbsItems.filter(item => item.parentId === newParentId);
                      const newCode = parent 
                        ? `${parent.code}.${siblings.length + 1}`
                        : `${wbsItems.filter(item => !item.parentId).length + 1}`;
                      form.setValue("code", newCode);

                      // Set isTopLevel flag
                      form.setValue("isTopLevel", !newParentId);

                      // Update type based on parent
                      if (!newParentId) {
                        // Top-level items can only be Summary
                        form.setValue("type", "Summary");
                      } else if (parent?.type === "Summary") {
                        // Under Summary, default to WorkPackage
                        form.setValue("type", "WorkPackage");
                      } else if (parent?.type === "WorkPackage") {
                        // Under WorkPackage, can only be Activity
                        form.setValue("type", "Activity");
                      }
                      
                      // Force a re-render of the allowed types
                      setTimeout(() => {
                        if (!newParentId) {
                          setAllowedTypes(["Summary"]);
                        } else if (parent?.type === "Summary") {
                          setAllowedTypes(["WorkPackage"]);
                        } else if (parent?.type === "WorkPackage") {
                          setAllowedTypes(["Activity"]);
                        }
                      }, 0);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a parent WBS item" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Parent (Top Level)</SelectItem>
                      {wbsItems
                        .filter(item => item.type !== "Activity") // Activities can't have children
                        .map((item) => (
                          <SelectItem key={item.id} value={item.id.toString()}>
                            {item.code} - {item.name} ({item.type})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Select the parent WBS item. Leave empty for top-level items.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>WBS Type</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={parentId === null || parentItem?.type === "WorkPackage"}
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
                      {!parentId ? 
                        "Top-level items must be Summary type" : 
                        parentItem?.type === "WorkPackage" ? 
                          "WorkPackage items can only have Activity children" :
                          "Summary items can only have WorkPackage children"
                      }
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      Automatically generated code
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                        placeholder="0.00"
                        max={type === "WorkPackage" && parentItem ? Number(parentItem.budgetedCost) : undefined}
                        {...field}
                        disabled={type === "Activity"}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value);
                          // For WorkPackage, ensure budget doesn't exceed parent budget
                          if (type === "WorkPackage" && parentItem && value > Number(parentItem.budgetedCost)) {
                            field.onChange(Number(parentItem.budgetedCost));
                            toast({
                              title: "Budget limit reached",
                              description: `Work package budget cannot exceed parent budget of ${formatCurrency(parentItem.budgetedCost)}`,
                              variant: "destructive",
                            });
                          } else {
                            field.onChange(value);
                          }
                        }}
                      />
                    </FormControl>
                    <FormDescription>
                      {type === "Activity" ? 
                        "Activity items cannot have a budget" : 
                        type === "WorkPackage" && parentItem ?
                          `Budget cannot exceed parent's budget of ${formatCurrency(parentItem.budgetedCost)}. Available: ${formatCurrency(remainingBudget)}` :
                          "Budget for this work item"
                      }
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Only show date fields for Activity type */}
            {type === "Activity" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

                <FormField
                  control={form.control}
                  name="level"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>WBS Level</FormLabel>
                      <FormControl>
                        <Input {...field} readOnly />
                      </FormControl>
                      <FormDescription>
                        Automatically determined
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {type !== "Activity" && (
              <FormField
                control={form.control}
                name="level"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>WBS Level</FormLabel>
                    <FormControl>
                      <Input {...field} readOnly />
                    </FormControl>
                    <FormDescription>
                      Automatically determined
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
                disabled={createWbsItem.isPending}
              >
                {createWbsItem.isPending && (
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                Add WBS Item
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
